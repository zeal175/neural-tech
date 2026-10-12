"""Collapse the UDIM layout of BUST_low into one 0-1 tile with extra density on the head.

Two quirks of the source asset are handled here:
  * applying multires leaves ~1e-7 UV mismatches along shared edges -> weld them;
  * hidden per-corner data in the asset makes Blender's packer fragment islands -> pack on a
    clean copy (positions, faces, UVs only) and copy the result back.
"""
import math
import os
import sys

sys.path.append(os.path.dirname(__file__))
import bmesh  # noqa: E402
import bpy  # noqa: E402
from bpy_extras.bmesh_utils import bmesh_linked_uv_islands  # noqa: E402
from mathutils import Vector  # noqa: E402

import common as C  # noqa: E402

HEAD_Z = 1.40         # islands centred above this get extra texels
HEAD_BOOST = 1.6      # linear scale factor -> 2.56x texel area for the face/head
HIDDEN_SCALE = 0.3    # caps, eye-socket pockets and the mouth bag are never seen
HIDDEN_FACE_SETS = {2, 3, 22}
MARGIN = 0.0045       # fraction of the atlas (~18 px at 4K)


def weld_uvs(bm, uv, tol=1e-5):
    welded = 0
    for v in bm.verts:
        groups = []
        for loop in v.link_loops:
            u = loop[uv].uv
            for ref, members in groups:
                if (ref - u).length <= tol:
                    members.append(loop)
                    break
            else:
                groups.append((u.copy(), [loop]))
        for ref, members in groups:
            for loop in members:
                if loop[uv].uv != ref:
                    loop[uv].uv = ref
                    welded += 1
    return welded


def island_stats(isl, uv):
    a3 = sum(f.calc_area() for f in isl)
    a2 = 0.0
    for f in isl:
        pts = [l[uv].uv for l in f.loops]
        for i in range(1, len(pts) - 1):
            a2 += abs((pts[i] - pts[0]).cross(pts[i + 1] - pts[0])) / 2.0
    zc = sum(f.calc_center_median().z * f.calc_area() for f in isl) / max(a3, 1e-12)
    return a3, a2, zc


def spread_and_scale(bm, uv):
    """Equalise texel density (+ head boost) and give every island its own spot.

    Islands must not overlap when the packer runs: overlapping UVs get cross-connected and the
    packer then moves fragments of islands independently.
    """
    islands = bmesh_linked_uv_islands(bm, uv)
    fs = bm.faces.layers.int.get(".sculpt_face_set")
    cap = bm.faces.layers.int.get("cap")

    def priority(isl, zc):
        hidden = sum(1 for f in isl if (cap and f[cap]) or (fs and f[fs] in HIDDEN_FACE_SETS))
        if hidden > len(isl) / 2:
            return HIDDEN_SCALE
        return HEAD_BOOST if zc > HEAD_Z else 1.0

    stats = [(isl, *island_stats(isl, uv)) for isl in islands]
    scales = [math.sqrt(a3 / a2) * priority(isl, zc) if a2 > 0 else 1.0
              for isl, a3, a2, zc in stats]
    ref = max(scales)
    for i, ((isl, _, _, _), s) in enumerate(zip(stats, scales)):
        us = [l[uv].uv.copy() for f in isl for l in f.loops]
        c = sum(us, Vector((0.0, 0.0))) / len(us)
        target = Vector((4.0 * i + 2.0, 2.0))
        k = s / ref
        for f in isl:
            for l in f.loops:
                l[uv].uv = target + (l[uv].uv - c) * k
    return len(islands)


def count_islands(mesh):
    bm = bmesh.new()
    bm.from_mesh(mesh)
    n = len(bmesh_linked_uv_islands(bm, bm.loops.layers.uv.active))
    bm.free()
    return n


def main():
    low = bpy.data.objects["BUST_low"]
    bm = bmesh.new()
    bm.from_mesh(low.data)
    uv = bm.loops.layers.uv.active
    welded = weld_uvs(bm, uv)
    n_islands = spread_and_scale(bm, uv)
    bm.to_mesh(low.data)
    bm.free()

    src = low.data
    n_loops = len(src.loops)
    flat = [0.0] * (n_loops * 2)
    src.uv_layers.active.data.foreach_get("uv", flat)
    clean = bpy.data.meshes.new("UVPACK")
    clean.from_pydata([tuple(v.co) for v in src.vertices], [], [tuple(p.vertices) for p in src.polygons])
    clean.uv_layers.new(name="UVMap")
    clean.uv_layers.active.data.foreach_set("uv", flat)
    tmp = bpy.data.objects.new("UVPACK", clean)
    bpy.context.scene.collection.objects.link(tmp)

    C.edit_mode(tmp)
    bpy.context.scene.tool_settings.use_uv_select_sync = False
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.select_all(action="SELECT")
    bpy.ops.uv.pack_islands(udim_source="CLOSEST_UDIM", rotate=True, rotate_method="ANY", scale=True,
                            margin_method="FRACTION", margin=MARGIN, shape_method="CONCAVE")
    C.object_mode()

    after = count_islands(clean)
    if after > n_islands * 2:
        raise RuntimeError(f"packer fragmented islands: {n_islands} -> {after}")
    clean.uv_layers.active.data.foreach_get("uv", flat)
    # CLOSEST_UDIM may land in another tile; shift back into 0-1 by whole tiles (exact).
    ox, oy = math.floor(min(flat[0::2])), math.floor(min(flat[1::2]))
    flat[0::2] = [u - ox for u in flat[0::2]]
    flat[1::2] = [v - oy for v in flat[1::2]]
    src.uv_layers.active.data.foreach_set("uv", flat)
    bpy.data.objects.remove(tmp, do_unlink=True)
    bpy.data.meshes.remove(clean)

    us = flat[0::2], flat[1::2]
    rng = [min(us[0]), max(us[0]), min(us[1]), max(us[1])]
    bpy.ops.wm.save_mainfile(compress=True)
    C.report(islands=n_islands, islands_after_pack=after, welded_loops=welded, uv_range=rng)


main()
