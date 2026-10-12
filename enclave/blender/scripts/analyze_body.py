"""Topology facts about a bundle body: face counts by height, holes (eye sockets etc.), UDIM tiles."""
import os
import sys

sys.path.append(os.path.dirname(__file__))
import bmesh  # noqa: E402
import bpy  # noqa: E402

import common as C  # noqa: E402

name = (C.script_args() or ["GEO-body_female_realistic"])[0]
C.clear_scene()
ob = C.append_objects([name])[0]
ob.location = (0, 0, 0)
bpy.context.view_layer.update()

bm = bmesh.new()
bm.from_mesh(ob.data)
bm.faces.ensure_lookup_table()

counts = {}
for z in (1.20, 1.25, 1.28, 1.30, 1.33, 1.36):
    counts[z] = sum(1 for f in bm.faces if f.calc_center_median().z >= z)

# boundary loops
boundary = [e for e in bm.edges if e.is_boundary]
seen, loops = set(), []
for e in boundary:
    if e in seen:
        continue
    stack, comp = [e], []
    while stack:
        cur = stack.pop()
        if cur in seen:
            continue
        seen.add(cur)
        comp.append(cur)
        for v in cur.verts:
            stack.extend(x for x in v.link_edges if x.is_boundary and x not in seen)
    vs = {v for ed in comp for v in ed.verts}
    cx = sum(v.co.x for v in vs) / len(vs)
    cy = sum(v.co.y for v in vs) / len(vs)
    cz = sum(v.co.z for v in vs) / len(vs)
    loops.append({"edges": len(comp), "center": [round(cx, 4), round(cy, 4), round(cz, 4)]})

uv = bm.loops.layers.uv.active
tiles = {}
for f in bm.faces:
    u = sum(l[uv].uv.x for l in f.loops) / len(f.loops)
    v = sum(l[uv].uv.y for l in f.loops) / len(f.loops)
    key = 1001 + int(u) + 10 * int(v)
    zc = f.calc_center_median().z
    t = tiles.setdefault(key, {"faces": 0, "zmin": 9, "zmax": -9})
    t["faces"] += 1
    t["zmin"] = round(min(t["zmin"], zc), 3)
    t["zmax"] = round(max(t["zmax"], zc), 3)

# nose tip -> facing direction
head = [v for v in bm.verts if v.co.z > 1.45]
nose = min(head, key=lambda v: v.co.y)
back = max(head, key=lambda v: v.co.y)

# face sets
fs_layer = bm.faces.layers.int.get(".sculpt_face_set")
face_sets = {}
if fs_layer:
    for f in bm.faces:
        k = f[fs_layer]
        d = face_sets.setdefault(k, {"faces": 0, "zmin": 9, "zmax": -9})
        d["faces"] += 1
        zc = f.calc_center_median().z
        d["zmin"] = round(min(d["zmin"], zc), 3)
        d["zmax"] = round(max(d["zmax"], zc), 3)

C.report(
    name=name,
    verts=len(bm.verts),
    faces=len(bm.faces),
    faces_above=counts,
    holes=loops,
    udim_tiles=tiles,
    nose=[round(c, 4) for c in nose.co],
    back_of_head=[round(c, 4) for c in back.co],
    face_sets=face_sets,
    attrs=[a.name for a in ob.data.attributes],
)
