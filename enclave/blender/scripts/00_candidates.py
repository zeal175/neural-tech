"""Render candidate base meshes under the poster-like rig so we can pick the closest one."""
import os
import sys

sys.path.append(os.path.dirname(__file__))
import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402

import common as C  # noqa: E402

CANDIDATES = ["GEO-body_male_realistic", "GEO-body_female_realistic", "GEO-head_sculpting_realistic"]

C.clear_scene()
device = C.setup_gpu()
C.set_color_management()
C.black_world(strength=0.0)
objs = C.append_objects(CANDIDATES)
mat = C.obsidian_material()

stats = {}
for ob in objs:
    ob.location.x = ob.location.y = 0.0  # bundle spreads assets along X
bpy.context.view_layer.update()
for ob in objs:
    for m in ob.modifiers:
        if m.type == "MULTIRES":
            m.levels = m.total_levels
            m.render_levels = m.total_levels
    ob.data.materials.clear()
    ob.data.materials.append(mat)
    top = max((ob.matrix_world @ v.co).z for v in ob.data.vertices)
    zmin = top - 0.55 if "body" in ob.name else None
    lo, hi = C.world_bbox(ob, zmin=zmin)
    stats[ob.name] = {"lo": list(lo), "hi": list(hi), "loc": list(ob.location)}

cam = C.camera(lens=85.0)
for ob in objs:
    for other in objs:
        other.hide_render = other is not ob
    lo, hi = Vector(stats[ob.name]["lo"]), Vector(stats[ob.name]["hi"])
    center = (lo + hi) / 2.0
    height = hi.z - lo.z
    for light in [o for o in bpy.data.objects if o.type == "LIGHT"]:
        bpy.data.objects.remove(light, do_unlink=True)
    head = Vector((center.x, center.y, hi.z - 0.13))
    C.poster_light_rig(head=tuple(head))
    tag = ob.name.replace("GEO-", "")
    for az, label in ((35.0, "q"), (0.0, "front"), (90.0, "side")):
        C.frame_camera(cam, center, height, azimuth_deg=az, elevation_deg=2.0)
        C.render_to(os.path.join(C.PREVIEWS, f"cand_{tag}_{label}.png"), res=(700, 860), samples=48)

C.report(device=device, stats=stats)
