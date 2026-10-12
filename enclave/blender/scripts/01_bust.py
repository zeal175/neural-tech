"""Build the ENCLAVE bust from the CC0 realistic female body.

Creates, in the master .blend:
  BUST_high  multires level 3 applied, cut + capped        (bake source)
  BUST_low   multires level 2 applied, cut + capped        (export mesh)
  EYE_L / EYE_R  realistic eyeballs fitted into the sockets, origin at eyeball centre
"""
import math
import os
import sys

sys.path.append(os.path.dirname(__file__))
import bmesh  # noqa: E402
import bpy  # noqa: E402
import numpy as np  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402

import common as C  # noqa: E402

SRC = "GEO-body_female_realistic"
HIGH_LEVEL, LOW_LEVEL = 3, 2

# Bust cut, in metres (figure faces -Y, left side is +X).
CUT_FRONT = (-0.12, 1.285)   # (y, z) on the chest: stays above the bust line
CUT_BACK = (0.10, 1.215)     # (y, z) on the back: keeps the shoulder blades
ARM_TOP = (0.200, 1.375)     # (|x|, z) outer shoulder point of the arm cut
ARM_LOW = (0.152, 1.240)     # (|x|, z) armpit point of the arm cut
NECK_STRETCH = C.NECK_STRETCH  # metres added to neck length (reference: long, elegant neck)
NECK_SLIM = 0.93             # neck girth factor at mid-neck (1 = keep anatomy)
NECK_BASE_Z = 1.385          # neck starts stretching here (just above the clavicles)
# head/neck boundary in (y, z): chin-throat crease -> skull base at the nape (see profile.py)
JAW_A = (-0.094, 1.414)
JAW_B = (0.016, 1.475)
NECK_AXIS_Y = -0.027         # neck centreline (y) for slimming


def torso_plane():
    (yf, zf), (yb, zb) = CUT_FRONT, CUT_BACK
    k = (zb - zf) / (yb - yf)
    no = Vector((0.0, -k, 1.0)).normalized()
    return Vector((0.0, yf, zf)), no


def arm_planes():
    (xt, zt), (xl, zl) = ARM_TOP, ARM_LOW
    d = Vector((xl - xt, 0.0, zl - zt)).normalized()          # along the cut line in XZ
    n_pos = Vector((-d.z, 0.0, d.x))                            # perpendicular
    if n_pos.x > 0:
        n_pos = -n_pos                                          # +X side keeps inner (-x) side
    n_neg = Vector((-n_pos.x, 0.0, n_pos.z))
    return [(Vector((xt, 0.0, zt)), n_pos), (Vector((-xt, 0.0, zt)), n_neg)]


def applied_copy(src, level, name):
    ob = src.copy()
    ob.data = src.data.copy()
    ob.name = name
    ob.data.name = name
    bpy.context.scene.collection.objects.link(ob)
    for m in ob.modifiers:
        if m.type == "MULTIRES":
            m.levels = m.sculpt_levels = m.render_levels = level
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg), preserve_all_data_layers=True, depsgraph=dg)
    ob.modifiers.clear()
    old = ob.data
    ob.data = me
    me.name = name
    bpy.data.meshes.remove(old)
    return ob


def stretch_neck(ob, amount, slim=1.0):
    """Lengthen (and slim) the neck only: the whole head, chin included, rises rigidly by
    `amount`; neck vertices interpolate between the neck base and the jaw line."""
    if amount <= 0 and slim >= 1.0:
        return
    (ya, za), (yb, zb) = JAW_A, JAW_B
    k = (zb - za) / (yb - ya)

    def smooth(t):
        t = min(max(t, 0.0), 1.0)
        return t * t * (3 - 2 * t)

    for v in ob.data.vertices:
        x, y, z = v.co
        jaw_z = za + (y - ya) * k                      # jaw line height above this vertex
        s = (z - NECK_BASE_Z) / max(jaw_z - NECK_BASE_Z, 0.008)
        t = smooth(s)
        if slim < 1.0 and 0.0 < s < 1.0:
            # strongest at mid-neck, none at the clavicles / jaw, none out on the trapezius
            w = math.sin(math.pi * s) * (1.0 - smooth((abs(x) - 0.05) / 0.025))
            f = 1.0 - (1.0 - slim) * w
            v.co.x = x * f
            v.co.y = NECK_AXIS_Y + (y - NECK_AXIS_Y) * f
        v.co.z = z + amount * t


def cut_and_cap(ob, cap_holes=True):
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    for co, no in arm_planes() + [torso_plane()]:
        geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
        bmesh.ops.bisect_plane(bm, geom=geom, dist=1e-7, plane_co=co, plane_no=no, clear_inner=True)
    # bisect leaves n-gons along the cut; MikkTSpace tangents (glTF export) need tris/quads
    ngons = [f for f in bm.faces if len(f.verts) > 4]
    if ngons:
        bmesh.ops.triangulate(bm, faces=ngons, quad_method="BEAUTY", ngon_method="BEAUTY")

    # Keep only the largest connected piece (drops stray fingertips etc.).
    bm.verts.ensure_lookup_table()
    unseen, parts = set(bm.verts), []
    while unseen:
        seed = unseen.pop()
        stack, part = [seed], {seed}
        while stack:
            v = stack.pop()
            for e in v.link_edges:
                o = e.other_vert(v)
                if o in unseen:
                    unseen.discard(o)
                    part.add(o)
                    stack.append(o)
        parts.append(part)
    parts.sort(key=len, reverse=True)
    for part in parts[1:]:
        bmesh.ops.delete(bm, geom=list(part), context="VERTS")

    cap = bm.faces.layers.int.get("cap") or bm.faces.layers.int.new("cap")
    for f in bm.faces:
        f[cap] = 0
        f.smooth = True
    boundary = [e for e in bm.edges if e.is_boundary] if cap_holes else []
    filled = bmesh.ops.holes_fill(bm, edges=boundary, sides=0)["faces"] if boundary else []
    for f in filled:
        f[cap] = 1  # triangulated faces inherit this layer
    if filled:
        bmesh.ops.triangulate(bm, faces=filled, quad_method="BEAUTY", ngon_method="BEAUTY")

    uv = bm.loops.layers.uv.active
    tri = [f for f in bm.faces if f[cap] == 1]
    for f in tri:
        f.smooth = False
        for loop in f.loops:  # planar projection; 02_uv packs these as their own islands
            loop[uv].uv = (20.0 + loop.vert.co.x * 2.0, 20.0 + loop.vert.co.y * 2.0)
    bm.to_mesh(ob.data)
    n_cap = len(tri)
    bm.free()
    if "custom_normal" in ob.data.attributes:
        ob.data.attributes.remove(ob.data.attributes["custom_normal"])
    return n_cap


def fit_sphere(points):
    p = np.asarray(points)
    A = np.c_[2 * p, np.ones(len(p))]
    b = (p ** 2).sum(1)
    sol, *_ = np.linalg.lstsq(A, b, rcond=None)
    c = sol[:3]
    r = math.sqrt(sol[3] + c @ c)
    return Vector(c), r


def socket_spheres(src):
    bm = bmesh.new()
    bm.from_mesh(src.data)
    fs = bm.faces.layers.int.get(".sculpt_face_set")
    out = {}
    for key in (2, 3):
        verts = {v for f in bm.faces if f[fs] == key for v in f.verts}
        c, r = fit_sphere([tuple(v.co) for v in verts])
        out["L" if c.x > 0 else "R"] = (c, r)
    bm.free()
    return out


def build_eye(template, side, center, radius):
    ob = template.copy()
    ob.data = template.data.copy()
    ob.name = ob.data.name = f"EYE_{side}"
    bpy.context.scene.collection.objects.link(ob)
    me = ob.data
    pts = np.array([tuple(v.co) for v in me.vertices])
    mid = (pts.min(0) + pts.max(0)) / 2
    rel = pts - mid
    dist = np.linalg.norm(rel, axis=1)
    apex = rel[dist.argmax()] / dist.max()          # cornea bulge = farthest point
    base_r = np.median(dist)                          # sclera radius
    s = radius / base_r
    rot = Vector(apex).rotation_difference(Vector((0.0, -1.0, 0.0))).to_matrix()
    for v, r in zip(me.vertices, rel):
        v.co = (rot @ Vector(r)) * s
    me.update()
    ob.matrix_world = Matrix.Translation(center)
    ob.parent = None
    for poly in me.polygons:
        poly.use_smooth = True
    if "custom_normal" in me.attributes:
        me.attributes.remove(me.attributes["custom_normal"])
    return ob


def main():
    C.clear_scene()
    src = C.append_objects([SRC])[0]
    src.location = (0, 0, 0)
    bpy.context.view_layer.update()
    sockets = socket_spheres(src)
    stretch_neck(src, NECK_STRETCH, NECK_SLIM)

    high = applied_copy(src, HIGH_LEVEL, "BUST_high")
    low = applied_copy(src, LOW_LEVEL, "BUST_low")
    # The bake source stays open at the cut so low-poly rays near the edge can't hit a cap.
    caps = {high.name: cut_and_cap(high, cap_holes=False), low.name: cut_and_cap(low)}

    template = C.append_objects(["Eye - Realistic"])[0]
    eyes = []
    for side, (c, r) in sockets.items():
        eyes.append(build_eye(template, side, c + Vector((0, 0, NECK_STRETCH)), r - 0.0004))
    bpy.data.objects.remove(template, do_unlink=True)
    bpy.data.objects.remove(src, do_unlink=True)

    mat = C.obsidian_material()
    for ob in [high, low] + eyes:
        ob.data.materials.clear()
        ob.data.materials.append(mat)
    high.hide_render = True
    high.hide_set(True)

    low["cut_front"] = CUT_FRONT
    low["cut_back"] = CUT_BACK
    for side, (c, r) in sockets.items():
        low[f"eye_{side}"] = list(c) + [r]

    for block in (bpy.data.meshes, bpy.data.materials):
        for item in list(block):
            if item.users == 0:
                block.remove(item)
    bpy.ops.wm.save_as_mainfile(filepath=C.MASTER, compress=True)

    # Previews: front 3/4 and the poster angle (behind-right).
    C.setup_gpu()
    C.set_color_management()
    C.black_world()
    lo, hi = C.world_bbox(low)
    center = (lo + hi) / 2
    head = Vector((0.0, -0.03, 1.52))
    C.poster_light_rig(head=tuple(head))
    cam = C.camera(lens=85)
    for az, label in ((35, "q"), (-140, "poster"), (0, "front")):
        C.frame_camera(cam, center, hi.z - lo.z, azimuth_deg=az, elevation_deg=4)
        C.render_to(os.path.join(C.PREVIEWS, f"bust_{label}.png"), res=(700, 860), samples=48)

    C.report(
        high_faces=len(high.data.polygons), low_faces=len(low.data.polygons),
        low_tris=sum(len(p.vertices) - 2 for p in low.data.polygons),
        low_verts=len(low.data.vertices), caps=caps,
        sockets={k: [list(v[0]), v[1]] for k, v in sockets.items()},
        bbox=[list(lo), list(hi)],
    )


main()
