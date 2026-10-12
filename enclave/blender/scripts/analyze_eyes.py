"""Close-up clay renders of the female head + sphere fit of the eye face sets."""
import os
import sys

sys.path.append(os.path.dirname(__file__))
import bmesh  # noqa: E402
import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402

import common as C  # noqa: E402

C.clear_scene()
C.setup_gpu()
C.set_color_management()
C.black_world(strength=0.6, color=(0.5, 0.5, 0.5))
ob = C.append_objects(["GEO-body_female_realistic"])[0]
ob.location = (0, 0, 0)
for m in ob.modifiers:
    if m.type == "MULTIRES":
        m.levels = m.render_levels = m.total_levels
bpy.context.view_layer.update()

bm = bmesh.new()
bm.from_mesh(ob.data)
fs = bm.faces.layers.int.get(".sculpt_face_set")
info = {}
for key in (2, 3, 4, 5, 7, 8, 22):
    faces = [f for f in bm.faces if f[fs] == key]
    verts = {v for f in faces for v in f.verts}
    c = sum((v.co for v in verts), Vector()) / len(verts)
    r = sum((v.co - c).length for v in verts) / len(verts)
    border = sum(1 for f in faces for e in f.edges if any(o[fs] != key for o in e.link_faces))
    info[key] = {"faces": len(faces), "center": [round(x, 4) for x in c], "mean_r": round(r, 4),
                 "border_edges": border}

clay = bpy.data.materials.new("Clay")
clay.use_nodes = True
b = clay.node_tree.nodes["Principled BSDF"]
b.inputs["Base Color"].default_value = (0.55, 0.52, 0.5, 1)
b.inputs["Roughness"].default_value = 0.6
ob.data.materials.clear()
ob.data.materials.append(clay)
C.area_light("Key", (0.6, -0.9, 1.9), (0, -0.08, 1.52), (1, 1, 1), 120, size=1.0)

cam = C.camera(lens=100)
center = Vector((0, -0.09, 1.525))
for az, label in ((0, "front"), (40, "q")):
    C.frame_camera(cam, center, 0.10, azimuth_deg=az, elevation_deg=0)
    C.render_to(os.path.join(C.PREVIEWS, f"eyes_{label}.png"), res=(900, 600), samples=32)
C.frame_camera(cam, Vector((0, -0.05, 1.50)), 0.30, azimuth_deg=20, elevation_deg=5)
C.render_to(os.path.join(C.PREVIEWS, "head_clay.png"), res=(800, 900), samples=32)
C.report(face_sets=info)
