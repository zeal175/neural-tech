"""Path-traced stills of the bust for social media (4:5, transparent background).

Satin-matte reference look under the website's "sculpture studio" light (Lighting.jsx). Uses the
baked 4K maps and the rig poses: 'poster' (behind-right, head turned up and away, the event
poster's framing), 'hero' (front three-quarter rest pose of the website) and 'pass' (three-quarter,
head bowed, gaze down: the art on the visitor's ENCLAVE pass; a calm figure that never stares back,
since the earlier face-on pass with lit eyes read as scary).
Outputs blender/renders/enclave_<name>.png (RGBA). `npm run pass-art` then adds the thin red
silhouette rim from the alpha contour, like the web shader, so it never catches inner folds.
Args: samples, then optionally the shots to render (`-ScriptArgs 64,pass`); add `preview` for a
quick half-size look in renders/previews (`-ScriptArgs 48,preview,pass`).
"""
import os
import sys

sys.path.append(os.path.dirname(__file__))
import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402

import common as C  # noqa: E402

ARGS = C.script_args()
SAMPLES = int(ARGS[0]) if ARGS else 256
# "preview" among the shot names: half size into renders/previews (quick look at a new angle)
PREVIEW = "preview" in ARGS[1:]
ONLY = set(ARGS[1:]) - {"preview"}
RES = (1080, 1350) if PREVIEW else (2160, 2700)
OUT_DIR = os.path.join(C.BLENDER_DIR, "renders", *(["previews"] if PREVIEW else []))
os.makedirs(OUT_DIR, exist_ok=True)

rig = bpy.data.objects["RIG"]
low = bpy.data.objects["BUST_low"]
eyes = [bpy.data.objects["EYE_L"], bpy.data.objects["EYE_R"]]
for name in ("BUST_high", "BUST_proxy"):
    bpy.data.objects[name].hide_render = True


def baked(name):
    img = bpy.data.images.load(os.path.join(C.BAKES, f"{name}_4k.png"), check_existing=True)
    img.colorspace_settings.name = "Non-Color"
    return img


def math_node(nt, op, a, b):
    m = nt.nodes.new("ShaderNodeMath")
    m.operation = op
    for i, src in enumerate((a, b)):
        if isinstance(src, (int, float)):
            m.inputs[i].default_value = src
        else:
            nt.links.new(src, m.inputs[i])
    return m.outputs[0]


def satin_textured():
    """Satin-matte black (the reference figure); roughness = baked satin map x 0.85, as on the web."""
    mat = bpy.data.materials.new("M_SatinBaked")
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    # the web material's values (bustMaterial.js, linear): #0b0e15, sheen 0.2 x #27324c, F0 x 0.8
    bsdf.inputs["Base Color"].default_value = (0.0033, 0.0043, 0.0075, 1.0)
    bsdf.inputs["Specular IOR Level"].default_value = 0.4
    bsdf.inputs["Sheen Weight"].default_value = 0.2
    bsdf.inputs["Sheen Roughness"].default_value = 0.55
    bsdf.inputs["Sheen Tint"].default_value = (0.02, 0.032, 0.072, 1.0)
    ntex = nt.nodes.new("ShaderNodeTexImage")
    ntex.image = baked("normal")
    ntex.interpolation = "Cubic"
    nmap = nt.nodes.new("ShaderNodeNormalMap")
    nt.links.new(ntex.outputs["Color"], nmap.inputs["Color"])
    nt.links.new(nmap.outputs["Normal"], bsdf.inputs["Normal"])
    otex = nt.nodes.new("ShaderNodeTexImage")
    otex.image = baked("orm")
    sep = nt.nodes.new("ShaderNodeSeparateColor")
    nt.links.new(otex.outputs["Color"], sep.inputs["Color"])
    nt.links.new(math_node(nt, "MULTIPLY", sep.outputs["Green"], 0.85), bsdf.inputs["Roughness"])

    # cut caps (face attribute from 01_bust.py) render as holdout: the bust dissolves into the dark
    cap = nt.nodes.new("ShaderNodeAttribute")
    cap.attribute_type = "GEOMETRY"
    cap.attribute_name = "cap"
    hold = nt.nodes.new("ShaderNodeHoldout")
    mix = nt.nodes.new("ShaderNodeMixShader")
    nt.links.new(cap.outputs["Fac"], mix.inputs["Fac"])
    nt.links.new(bsdf.outputs[0], mix.inputs[1])
    nt.links.new(hold.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], nt.nodes["Material Output"].inputs["Surface"])
    return mat


def eye_material():
    """Matte eyeball, a touch glossier than the skin (like the website's eyes at rest)."""
    mat = bpy.data.materials.new("M_EyeSatin")
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (0.008, 0.01, 0.015, 1.0)
    bsdf.inputs["Roughness"].default_value = 0.4
    bsdf.inputs["Specular IOR Level"].default_value = 0.45
    return mat


def strip(name, location, target, color, strength, size):
    """Emissive light strip (reflects as a clean line on the glossy surface, unlike a point light)."""
    bpy.ops.mesh.primitive_plane_add(size=1.0, location=location)
    ob = bpy.context.active_object
    ob.name = name
    ob.scale = (size[0], size[1], 1.0)
    C.look_at(ob, target)
    mat = bpy.data.materials.new(f"M_{name}")
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    em = nt.nodes.new("ShaderNodeEmission")
    em.inputs["Color"].default_value = (*color, 1.0)
    em.inputs["Strength"].default_value = strength
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    nt.links.new(em.outputs[0], out.inputs["Surface"])
    ob.data.materials.append(mat)
    ob.visible_camera = False  # lights the bust, never seen directly
    return ob


def main():
    import math

    mat = satin_textured()
    low.data.materials.clear()
    low.data.materials.append(mat)
    eye = eye_material()
    for e in eyes:
        e.data.materials.clear()
        e.data.materials.append(eye)

    for ob in [o for o in bpy.data.objects
               if o.type in {"LIGHT", "CAMERA"} or o.name.startswith(("STRIP_", "LIGHTRIG"))]:
        bpy.data.objects.remove(ob, do_unlink=True)
    scene = bpy.context.scene
    device = C.setup_gpu(scene)
    C.set_color_management(scene)
    C.black_world(scene, strength=0.0)
    scene.cycles.use_denoising = True

    # The website's "sculpture studio" light (Lighting.jsx): a big soft key high camera-left, tall
    # strip lights behind left and right tracing skull, jaw and neck, a dim cool top light. Panels
    # sit on a 2.5 m sphere around the head with the web panels' angular sizes and radiance;
    # directions are in the camera's frame (-Y toward the camera, +X camera-right) and the rig
    # turns with the camera.
    head = Vector((0.0, -0.03, 1.545))
    rig_empty = bpy.data.objects.new("LIGHTRIG", None)
    scene.collection.objects.link(rig_empty)

    def panel(name, direction, w_deg, h_deg, color, radiance, dist=2.5):
        size = tuple(2 * dist * math.tan(math.radians(a / 2)) for a in (w_deg, h_deg))
        ob = strip(name, head + Vector(direction).normalized() * dist, head, color, radiance, size)
        ob.parent = rig_empty
        return ob

    panel("STRIP_key", (-0.55, -0.65, 0.5), 60, 50, (0.80, 0.84, 1.0), 1.7)
    panel("STRIP_right", (0.95, 0.32, 0.12), 9, 95, (1.0, 1.0, 1.0), 8.5)
    panel("STRIP_left", (-0.92, 0.4, 0.05), 7, 85, (0.59, 0.68, 1.0), 4.8)
    panel("STRIP_top", (0.1, -0.15, 1.0), 70, 30, (0.35, 0.45, 0.81), 0.9)

    cam = C.camera(lens=85)
    s = C.NECK_STRETCH / 2
    shots = {
        # name: (yaw, pitch, camera azimuth, elevation, framed height, frame centre z)
        # framed tight like the poster: the bottom edge crops the cut and the arm caps
        "poster": (-40, 25, -140, 4, 0.45, 1.475 + s),
        "hero": (28, 17, -35, 3, 0.44, 1.478 + s),
        # three-quarter, head bowed and gaze down, camera a little above: quiet, never staring
        # back (picked over a profile, a gaze to the sky and a neon silhouette)
        "pass": (-5, -15, -20, 6, 0.40, 1.49 + s),
    }
    rendered = []
    for name, (yaw, pitch, az, el, height, cz) in shots.items():
        if ONLY and name not in ONLY:
            continue
        rig_empty.rotation_euler = (0.0, 0.0, math.radians(az))
        C.pose_chain(rig, yaw, pitch)
        C.frame_camera(cam, Vector((0.0, -0.02, cz)), height, azimuth_deg=az, elevation_deg=el)
        path = os.path.join(OUT_DIR, f"enclave_{name}.png")
        C.render_to(path, res=RES, samples=SAMPLES, transparent=True, scene=scene)
        rendered.append(path)
    C.pose_chain(rig, 0, 0)
    C.report(device=device, rendered=rendered, samples=SAMPLES)


main()
