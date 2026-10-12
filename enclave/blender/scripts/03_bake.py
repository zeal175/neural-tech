"""Bake the 4K texture masters for BUST_low (Cycles, GPU) and pack them for glTF.

Outputs in blender/bakes/ (16-bit PNG, Non-Color):
  normal_4k.png   tangent-space normal, high (multires L3) -> low (L2), OpenGL / glTF convention
  orm_4k.png      R = ambient occlusion, G = roughness, B = metalness (0)
  data_4k.png     R = curvature (convex > 0.5), G = thickness (thin = dark), B = cavity
  detail_1k.png   tileable micro-surface normal (polished ceramic undulation + pits)
"""
import os
import sys
import time

sys.path.append(os.path.dirname(__file__))
import bpy  # noqa: E402
import numpy as np  # noqa: E402

import common as C  # noqa: E402

SIZE = int((C.script_args() or ["4096"])[0])
TAG = f"{SIZE // 1024}k"

scene = bpy.context.scene
low = bpy.data.objects["BUST_low"]
high = bpy.data.objects["BUST_high"]
eyes = [bpy.data.objects["EYE_L"], bpy.data.objects["EYE_R"]]
device = C.setup_gpu(scene)
bake = scene.render.bake
bake.margin = max(8, SIZE // 256)
bake.margin_type = "ADJACENT_FACES"
original_materials = list(low.data.materials)


def new_image(name):
    old = bpy.data.images.get(name)
    if old:
        bpy.data.images.remove(old)
    img = bpy.data.images.new(name, SIZE, SIZE, alpha=False, float_buffer=True, is_data=True)
    img.colorspace_settings.name = "Non-Color"
    return img


def material_for(image, emit=None):
    mat = bpy.data.materials.new(f"BAKE_{image.name}")
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    if emit is None:
        shader = nt.nodes.new("ShaderNodeBsdfPrincipled")
        nt.links.new(shader.outputs[0], out.inputs["Surface"])
    else:
        shader = nt.nodes.new("ShaderNodeEmission")
        shader.inputs["Strength"].default_value = 1.0
        nt.links.new(emit(nt), shader.inputs["Color"])
        nt.links.new(shader.outputs[0], out.inputs["Surface"])
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = image
    nt.nodes.active = tex
    return mat


def run_bake(kind, image, samples, emit=None, selected_to_active=False, **kw):
    low.data.materials.clear()
    low.data.materials.append(material_for(image, emit))
    high.hide_render = not selected_to_active
    for ob in bpy.data.objects:
        ob.select_set(False)
    low.select_set(True)
    if selected_to_active:
        high.hide_set(False)
        high.select_set(True)
    bpy.context.view_layer.objects.active = low
    scene.cycles.samples = samples
    t = time.time()
    bpy.ops.object.bake(type=kind, use_selected_to_active=selected_to_active, target="IMAGE_TEXTURES",
                        use_clear=True, margin=bake.margin, margin_type=bake.margin_type, **kw)
    arr = C.image_to_array(image)[..., :3].copy()
    return arr, round(time.time() - t, 1)


# --- node graphs for emission bakes -------------------------------------------------------------
def ao_node(nt, distance, inside=False, samples=16):
    ao = nt.nodes.new("ShaderNodeAmbientOcclusion")
    ao.samples = samples
    ao.inside = inside
    ao.only_local = inside
    ao.inputs["Distance"].default_value = distance
    return ao


def thickness_graph(nt):
    return ao_node(nt, 0.03, inside=True).outputs["AO"]


def cavity_graph(nt):
    return ao_node(nt, 0.012).outputs["AO"]


def curvature_graph(nt):
    geo = nt.nodes.new("ShaderNodeNewGeometry")
    ramp = nt.nodes.new("ShaderNodeMapRange")
    ramp.inputs["From Min"].default_value = 0.44
    ramp.inputs["From Max"].default_value = 0.56
    nt.links.new(geo.outputs["Pointiness"], ramp.inputs["Value"])
    return ramp.outputs["Result"]


def roughness_graph(nt):
    """Satin matte (the reference): soft overall sheen, high points burnished slightly glossier,
    crevices drier/rougher, very faint handling smudges."""
    coord = nt.nodes.new("ShaderNodeTexCoord")

    def noise(scale, detail, rough, dist=0.0):
        n = nt.nodes.new("ShaderNodeTexNoise")
        n.inputs["Scale"].default_value = scale
        n.inputs["Detail"].default_value = detail
        n.inputs["Roughness"].default_value = rough
        n.inputs["Distortion"].default_value = dist
        nt.links.new(coord.outputs["Object"], n.inputs["Vector"])
        return n

    def map_range(src, a, b, c, d):
        m = nt.nodes.new("ShaderNodeMapRange")
        m.clamp = True
        nt.links.new(src, m.inputs["Value"])
        m.inputs["From Min"].default_value = a
        m.inputs["From Max"].default_value = b
        m.inputs["To Min"].default_value = c
        m.inputs["To Max"].default_value = d
        return m.outputs["Result"]

    def add(a, b):
        m = nt.nodes.new("ShaderNodeMath")
        m.operation = "ADD"
        nt.links.new(a, m.inputs[0])
        nt.links.new(b, m.inputs[1])
        return m.outputs[0]

    geo = nt.nodes.new("ShaderNodeNewGeometry")
    smudge = map_range(noise(5.0, 3.0, 0.5, 0.8).outputs["Fac"], 0.45, 0.75, -0.04, 0.05)
    grain = map_range(noise(60.0, 4.0, 0.6).outputs["Fac"], 0.35, 0.65, -0.015, 0.015)
    burnish = map_range(geo.outputs["Pointiness"], 0.5, 0.56, 0.0, -0.1)
    crevice = map_range(ao_node(nt, 0.025).outputs["AO"], 1.0, 0.55, 0.0, 0.1)
    base = nt.nodes.new("ShaderNodeValue")
    base.outputs[0].default_value = 0.56
    return add(add(add(add(base.outputs[0], smudge), grain), burnish), crevice)


# --- tileable micro-detail normal ------------------------------------------------------------
def detail_normal(n=1024, seed=7):
    """Powder-coat micro surface: a soft 'orange-peel' undulation plus fine bead-blast grain.
    Built in the frequency domain, so the tile is seamless by construction."""
    rng = np.random.default_rng(seed)
    fy = np.fft.fftfreq(n)[:, None]
    fx = np.fft.fftfreq(n)[None, :]
    f = np.sqrt(fx ** 2 + fy ** 2)
    f[0, 0] = 1.0

    def band(centre, width):
        return np.exp(-((np.log(f * n) - np.log(centre)) ** 2) / width)

    peel = band(45.0, 0.5)
    grain = 0.55 * band(280.0, 0.35)
    spec = (peel + grain) / f ** 0.5 * np.exp(2j * np.pi * rng.random((n, n)))
    h = np.real(np.fft.ifft2(spec))
    h = (h - h.mean()) / (h.std() + 1e-9)
    strength = 0.7
    gx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * 0.5 * strength
    gy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * 0.5 * strength
    nrm = np.dstack([-gx, gy, np.ones_like(h) * 6.0])
    nrm /= np.linalg.norm(nrm, axis=2, keepdims=True)
    return nrm * 0.5 + 0.5


HIDDEN_FACE_SETS = (2, 3, 22)  # eye-socket pockets, nostril/mouth interior


def clean_normals(normal, ao):
    """Flatten the normal map where it can only hold ray-cast garbage: hidden parts (caps,
    socket pockets, nostril/mouth interiors) and fully occluded cavities."""
    me = low.data
    n = len(me.polygons)
    hidden = np.zeros(n, dtype=bool)
    if "cap" in me.attributes:
        cap = np.zeros(n, dtype=np.int32)
        me.attributes["cap"].data.foreach_get("value", cap)
        hidden |= cap == 1
    if ".sculpt_face_set" in me.attributes:
        fs = np.zeros(n, dtype=np.int32)
        me.attributes[".sculpt_face_set"].data.foreach_get("value", fs)
        hidden |= np.isin(fs, HIDDEN_FACE_SETS)
    mask = C.dilate(C.rasterize_uv_mask(me, hidden, SIZE), bake.margin).astype(np.float32)
    deep = np.clip((0.30 - ao[..., 0]) / 0.15, 0.0, 1.0)
    w = np.maximum(mask, deep)[..., None]
    v = normal * 2.0 - 1.0
    v = v * (1.0 - w) + np.array([0.0, 0.0, 1.0], dtype=np.float32) * w
    v /= np.maximum(np.linalg.norm(v, axis=2, keepdims=True), 1e-6)
    return v * 0.5 + 0.5, float(w.mean())


def main():
    timings = {}
    img = new_image("normal")
    normal, timings["normal"] = run_bake("NORMAL", img, 4, selected_to_active=True,
                                         cage_extrusion=0.001, max_ray_distance=0.0025,
                                         normal_space="TANGENT", normal_r="POS_X", normal_g="POS_Y",
                                         normal_b="POS_Z")
    bpy.data.images.remove(img)

    scene.world.light_settings.distance = 0.07
    img = new_image("ao")
    ao, timings["ao"] = run_bake("AO", img, 192)
    bpy.data.images.remove(img)
    normal, flattened = clean_normals(normal, ao)
    C.write_png(os.path.join(C.BAKES, f"normal_{TAG}.png"), normal)

    img = new_image("rough")
    rough, timings["rough"] = run_bake("EMIT", img, 32, emit=roughness_graph)
    bpy.data.images.remove(img)

    img = new_image("curv")
    curv, timings["curv"] = run_bake("EMIT", img, 4, emit=curvature_graph)
    bpy.data.images.remove(img)

    img = new_image("thick")
    thick, timings["thick"] = run_bake("EMIT", img, 32, emit=thickness_graph)
    bpy.data.images.remove(img)

    img = new_image("cavity")
    cav, timings["cavity"] = run_bake("EMIT", img, 32, emit=cavity_graph)
    bpy.data.images.remove(img)

    orm = np.dstack([ao[..., 0], np.clip(rough[..., 0], 0, 1), np.zeros_like(ao[..., 0])])
    data = np.dstack([curv[..., 0], thick[..., 0], cav[..., 0]])
    C.write_png(os.path.join(C.BAKES, f"orm_{TAG}.png"), orm)
    C.write_png(os.path.join(C.BAKES, f"data_{TAG}.png"), data)
    C.write_png(os.path.join(C.BAKES, "detail_1k.png"), detail_normal())

    low.data.materials.clear()
    for m in original_materials:
        low.data.materials.append(m)
    for m in list(bpy.data.materials):
        if m.name.startswith("BAKE_"):
            bpy.data.materials.remove(m)
    high.hide_render = True
    bpy.ops.wm.save_mainfile(compress=True)

    def stats(a):
        return [round(float(a.min()), 3), round(float(a.mean()), 3), round(float(a.max()), 3)]

    C.report(device=device, size=SIZE, seconds=timings, flattened=round(flattened, 3),
             ao=stats(ao[..., 0]), rough=stats(rough[..., 0]),
             curv=stats(curv[..., 0]), thick=stats(thick[..., 0]), cavity=stats(cav[..., 0]),
             normal_z=stats(normal[..., 2]))


main()
