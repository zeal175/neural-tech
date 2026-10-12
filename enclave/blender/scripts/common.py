"""Shared helpers for the ENCLAVE bust pipeline (run inside Blender)."""
import json
import math
import os
import sys

import bpy
from mathutils import Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
BLENDER_DIR = os.path.join(ROOT, "blender")
BUNDLE = os.path.join(
    BLENDER_DIR, "source", "human-base-meshes-bundle-v1.4.1", "human_base_meshes_bundle.blend"
)
MASTER = os.path.join(BLENDER_DIR, "enclave_bust.blend")
PREVIEWS = os.path.join(BLENDER_DIR, "previews")
BAKES = os.path.join(BLENDER_DIR, "bakes")
PUBLIC_MODELS = os.path.join(ROOT, "public", "models")

for d in (PREVIEWS, BAKES):
    os.makedirs(d, exist_ok=True)

# Neck lengthening applied in 01_bust.py; everything at/above the jaw line rises by this much,
# so head landmarks used by later scripts (rig pivot, jaw plane) shift with it.
NECK_STRETCH = 0.025


def script_args():
    """Arguments after `--` on the Blender command line."""
    return sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []


def report(**data):
    """Print a machine-readable line the driver can grep for."""
    print("@@JSON@@" + json.dumps(data, default=str))


def clear_scene():
    for ob in list(bpy.data.objects):
        bpy.data.objects.remove(ob, do_unlink=True)
    for coll in (bpy.data.meshes, bpy.data.materials, bpy.data.lights, bpy.data.cameras):
        for block in list(coll):
            if block.users == 0:
                coll.remove(block)


def append_objects(names, path=BUNDLE):
    with bpy.data.libraries.load(path, link=False) as (src, dst):
        missing = [n for n in names if n not in src.objects]
        if missing:
            raise RuntimeError(f"Objects not in bundle: {missing}")
        dst.objects = list(names)
    out = []
    for ob in dst.objects:
        bpy.context.scene.collection.objects.link(ob)
        out.append(ob)
    bpy.context.view_layer.update()  # matrix_world is stale until the depsgraph runs
    return out


def setup_gpu(scene=None):
    scene = scene or bpy.context.scene
    scene.render.engine = "CYCLES"
    prefs = bpy.context.preferences.addons["cycles"].preferences
    chosen = None
    # CUDA first: the installed NVIDIA driver (566.07) is too old for Blender 5.2's OptiX kernel.
    for kind in ("CUDA", "OPTIX"):
        try:
            prefs.compute_device_type = kind
            if hasattr(prefs, "refresh_devices"):
                prefs.refresh_devices()
            else:
                prefs.get_devices()
            gpus = [d for d in prefs.devices if d.type == kind]
            if gpus:
                for d in prefs.devices:
                    d.use = d.type == kind
                chosen = kind
                break
        except Exception:  # device type unavailable on this machine
            continue
    scene.cycles.device = "GPU" if chosen else "CPU"
    return chosen or "CPU"


def set_color_management(scene=None):
    scene = scene or bpy.context.scene
    vs = scene.view_settings
    try:
        vs.view_transform = "AgX"
    except TypeError:
        pass
    for look in ("AgX - Medium High Contrast", "Medium High Contrast"):
        try:
            vs.look = look
            break
        except TypeError:
            continue


def black_world(scene=None, strength=0.0, color=(0.0, 0.0, 0.0)):
    scene = scene or bpy.context.scene
    world = scene.world or bpy.data.worlds.new("World")
    scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    bg.inputs["Color"].default_value = (*color, 1.0)
    bg.inputs["Strength"].default_value = strength
    return world


def obsidian_material(name="M_Obsidian"):
    """Preview / reference material: glossy black glazed ceramic."""
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (0.010, 0.011, 0.015, 1.0)
    bsdf.inputs["Roughness"].default_value = 0.28
    bsdf.inputs["IOR"].default_value = 1.5
    for key, val in (("Coat Weight", 1.0), ("Coat Roughness", 0.06)):
        if key in bsdf.inputs:
            bsdf.inputs[key].default_value = val
    return mat


def area_light(name, location, target, color, power, size=0.5, shape="RECTANGLE", size_y=None):
    data = bpy.data.lights.new(name, type="AREA")
    data.color = color
    data.energy = power
    data.shape = shape
    data.size = size
    if size_y is not None and shape in ("RECTANGLE", "ELLIPSE"):
        data.size_y = size_y
    ob = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(ob)
    ob.location = location
    look_at(ob, target)
    return ob


def look_at(ob, target):
    direction = Vector(target) - ob.location
    ob.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def poster_light_rig(head=(0.0, 0.0, 1.55)):
    """Orange rim behind-right, red counter rim low-left, faint cool fill front-top."""
    hx, hy, hz = head
    lights = [
        area_light("L_RimOrange", (hx + 0.75, hy + 0.55, hz + 0.25), (hx, hy, hz - 0.05),
                   (1.0, 0.33, 0.14), 260.0, size=0.35, size_y=1.2),
        area_light("L_RimRed", (hx - 0.70, hy + 0.45, hz - 0.30), (hx, hy, hz - 0.15),
                   (1.0, 0.12, 0.06), 160.0, size=0.3, size_y=0.9),
        area_light("L_FillCool", (hx - 0.45, hy - 1.4, hz + 0.9), (hx, hy, hz),
                   (0.62, 0.72, 1.0), 22.0, size=1.4),
        area_light("L_TopSheen", (hx + 0.1, hy - 0.2, hz + 1.1), (hx, hy, hz),
                   (0.75, 0.82, 1.0), 18.0, size=0.6),
    ]
    return lights


def camera(name="CAM", lens=85.0):
    data = bpy.data.cameras.new(name)
    data.lens = lens
    data.sensor_fit = "VERTICAL"
    data.sensor_height = 24.0
    ob = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(ob)
    bpy.context.scene.camera = ob
    return ob


def frame_camera(cam, center, height, azimuth_deg=0.0, elevation_deg=0.0, margin=1.08):
    """Place `cam` so a box of `height` metres around `center` fills the frame.

    azimuth 0 = straight in front of a figure facing -Y; positive = toward +X (figure's left).
    """
    fov = 2.0 * math.atan((cam.data.sensor_height / 2.0) / cam.data.lens)
    dist = (height * margin / 2.0) / math.tan(fov / 2.0)
    az = math.radians(azimuth_deg)
    el = math.radians(elevation_deg)
    offset = Vector((math.sin(az) * math.cos(el), -math.cos(az) * math.cos(el), math.sin(el))) * dist
    cam.location = Vector(center) + offset
    look_at(cam, center)
    return dist


def render_to(path, res=(900, 1100), samples=64, transparent=False, scene=None):
    scene = scene or bpy.context.scene
    scene.render.resolution_x, scene.render.resolution_y = res
    scene.render.resolution_percentage = 100
    scene.cycles.samples = samples
    scene.cycles.use_denoising = True
    scene.render.film_transparent = transparent
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA" if transparent else "RGB"
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    return path


# share of a gaze rotation each bone takes; mirrored by CHAIN in components/hero/Bust.jsx
POSE_SPLIT = {"chest": 0.10, "neck_01": 0.20, "neck_02": 0.25, "head": 0.45}


def pose_chain(rig, yaw_deg=0.0, pitch_deg=0.0):
    """World-axis yaw (+ = turn to the figure's left) and pitch (+ = chin up) split over the chain."""
    from mathutils import Quaternion

    for pb in rig.pose.bones:
        pb.rotation_mode = "QUATERNION"
        pb.rotation_quaternion = Quaternion()
    for name, share in POSE_SPLIT.items():
        pb = rig.pose.bones[name]
        rest = pb.bone.matrix_local.to_quaternion()
        q_world = Quaternion(Vector((0, 0, 1)), math.radians(yaw_deg * share)) @ \
            Quaternion(Vector((1, 0, 0)), math.radians(-pitch_deg * share))
        pb.rotation_quaternion = rest.inverted() @ q_world @ rest
    bpy.context.view_layer.update()


def image_to_array(img):
    """Blender image pixels -> float32 array (H, W, 4), top row first."""
    import numpy as np

    w, h = img.size
    buf = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(buf)
    return buf.reshape(h, w, 4)[::-1]


def write_png(path, arr, bits=16):
    """Write an (H, W, C) float array in [0, 1] as a PNG, bypassing colour management."""
    import struct
    import zlib

    import numpy as np

    arr = np.clip(np.asarray(arr, dtype=np.float32), 0.0, 1.0)
    if arr.ndim == 2:
        arr = arr[..., None]
    h, w, ch = arr.shape
    color_type = {1: 0, 2: 4, 3: 2, 4: 6}[ch]
    if bits == 16:
        data = (arr * 65535.0 + 0.5).astype(">u2")
    else:
        data = (arr * 255.0 + 0.5).astype(np.uint8)
    rows = data.reshape(h, -1).view(np.uint8).reshape(h, -1)
    raw = np.hstack([np.zeros((h, 1), dtype=np.uint8), rows]).tobytes()

    def chunk(tag, payload):
        body = tag + payload
        return struct.pack(">I", len(payload)) + body + struct.pack(">I", zlib.crc32(body) & 0xFFFFFFFF)

    ihdr = struct.pack(">IIBBBBB", w, h, bits, color_type, 0, 0, 0)
    with open(path, "wb") as fh:
        fh.write(b"\x89PNG\r\n\x1a\n")
        fh.write(chunk(b"IHDR", ihdr))
        fh.write(chunk(b"IDAT", zlib.compress(raw, 6)))
        fh.write(chunk(b"IEND", b""))
    return path


def rasterize_uv_mask(me, poly_mask, size):
    """(size, size) bool mask (top row first) of texels covered by polygons where poly_mask is True."""
    import numpy as np

    me.calc_loop_triangles()
    n = len(me.loop_triangles)
    loops = np.zeros(n * 3, dtype=np.int32)
    polys = np.zeros(n, dtype=np.int32)
    me.loop_triangles.foreach_get("loops", loops)
    me.loop_triangles.foreach_get("polygon_index", polys)
    uvs = np.zeros(len(me.loops) * 2, dtype=np.float32)
    me.uv_layers.active.data.foreach_get("uv", uvs)
    uvs = uvs.reshape(-1, 2)
    tris = uvs[loops.reshape(-1, 3)[np.asarray(poly_mask)[polys]]] * size
    mask = np.zeros((size, size), dtype=bool)
    for a, b, c in tris:
        x0, x1 = int(max(min(a[0], b[0], c[0]) - 1, 0)), int(min(max(a[0], b[0], c[0]) + 2, size))
        y0, y1 = int(max(min(a[1], b[1], c[1]) - 1, 0)), int(min(max(a[1], b[1], c[1]) + 2, size))
        if x1 <= x0 or y1 <= y0:
            continue
        xs, ys = np.meshgrid(np.arange(x0, x1) + 0.5, np.arange(y0, y1) + 0.5)
        e0 = (b[0] - a[0]) * (ys - a[1]) - (b[1] - a[1]) * (xs - a[0])
        e1 = (c[0] - b[0]) * (ys - b[1]) - (c[1] - b[1]) * (xs - b[0])
        e2 = (a[0] - c[0]) * (ys - c[1]) - (a[1] - c[1]) * (xs - c[0])
        inside = ((e0 >= 0) & (e1 >= 0) & (e2 >= 0)) | ((e0 <= 0) & (e1 <= 0) & (e2 <= 0))
        mask[y0:y1, x0:x1] |= inside
    return mask[::-1]


def dilate(mask, px):
    import numpy as np

    out = mask.copy()
    for _ in range(px):
        grown = out.copy()
        grown[1:] |= out[:-1]
        grown[:-1] |= out[1:]
        grown[:, 1:] |= out[:, :-1]
        grown[:, :-1] |= out[:, 1:]
        out = grown
    return out


def edit_mode(ob):
    bpy.ops.object.mode_set(mode="OBJECT") if bpy.context.object and bpy.context.object.mode != "OBJECT" else None
    for o in bpy.context.selected_objects:
        o.select_set(False)
    ob.hide_set(False)
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.mode_set(mode="EDIT")


def object_mode():
    if bpy.context.object and bpy.context.object.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")


def world_bbox(ob, zmin=None):
    mw = ob.matrix_world
    pts = [mw @ v.co for v in ob.data.vertices]
    if zmin is not None:
        pts = [p for p in pts if p.z >= zmin]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return lo, hi
