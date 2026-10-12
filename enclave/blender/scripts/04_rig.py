"""Rig the bust: chest -> neck_01 -> neck_02 -> head (+ shoulder.L/R), skin BUST_low, parent eyes,
build a light skinned raycast proxy, then render deformation tests at extreme poses."""
import os
import sys

sys.path.append(os.path.dirname(__file__))
import bpy  # noqa: E402
from mathutils import Quaternion, Vector  # noqa: E402

import common as C  # noqa: E402

S = C.NECK_STRETCH                          # head landmarks rise with the neck stretch
HEAD_PIVOT = Vector((0.0, -0.030, 1.485 + S))   # skull base, between the ears
HEAD_TOP = 1.640 + S
CHEST_Z = 1.25
PROXY_RATIO = 0.025                          # ~3.3k triangles

low = bpy.data.objects["BUST_low"]
eyes = [bpy.data.objects["EYE_L"], bpy.data.objects["EYE_R"]]


def slab_centroid(z, dz=0.003, xmax=0.065, ymin=-0.09):
    pts = [v.co for v in low.data.vertices
           if abs(v.co.z - z) < dz and abs(v.co.x) < xmax and v.co.y > ymin]
    return sum(pts, Vector()) / len(pts)


def build_armature():
    old_rig = bpy.data.objects.get("RIG")
    if old_rig:  # re-run: detach children in place before deleting the old rig
        for pb in old_rig.pose.bones:
            pb.rotation_mode = "QUATERNION"
            pb.rotation_quaternion = Quaternion()
        bpy.context.view_layer.update()
        for child in [o for o in bpy.data.objects if o.parent == old_rig]:
            mw = child.matrix_world.copy()
            child.parent = None
            child.matrix_world = mw
    for name in ("RIG", "BUST_proxy"):
        old = bpy.data.objects.get(name)
        if old:
            bpy.data.objects.remove(old, do_unlink=True)
    for m in [m for m in low.modifiers if m.type == "ARMATURE"]:
        low.modifiers.remove(m)
    data = bpy.data.armatures.new("RIG")
    rig = bpy.data.objects.new("RIG", data)
    bpy.context.scene.collection.objects.link(rig)
    base = slab_centroid(1.395)
    base.x = 0.0
    C.edit_mode(rig)
    eb = data.edit_bones

    def bone(name, head, tail, parent=None, connect=False):
        b = eb.new(name)
        b.head, b.tail, b.roll = head, tail, 0.0
        if parent:
            b.parent = eb[parent]
            b.use_connect = connect
        return b

    bone("chest", Vector((0.0, base.y, CHEST_Z)), base)
    bone("neck_01", base, base.lerp(HEAD_PIVOT, 0.5), "chest", True)
    bone("neck_02", base.lerp(HEAD_PIVOT, 0.5), HEAD_PIVOT, "neck_01", True)
    bone("head", HEAD_PIVOT, Vector((HEAD_PIVOT.x, HEAD_PIVOT.y, HEAD_TOP)), "neck_02", True)
    for side, sx in (("L", 1.0), ("R", -1.0)):
        bone(f"shoulder.{side}", Vector((0.025 * sx, base.y + 0.004, 1.378)),
             Vector((0.165 * sx, base.y + 0.010, 1.372)), "chest")
    C.object_mode()
    return rig, base


# Head/neck boundary: a plane through the chin-throat crease and the skull base at the nape
# (measured with profile.py). Bone-heat weighting fails on this small-scale mesh, and an
# analytic split is smoother and fully predictable anyway.
JAW_A = Vector((0.0, -0.094, 1.414 + S))
JAW_B = Vector((0.0, 0.016, 1.475 + S))


def smoothstep(e0, e1, x):
    t = min(max((x - e0) / (e1 - e0), 0.0), 1.0)
    return t * t * (3.0 - 2.0 * t)


def weights_for(co):
    d_ab = JAW_B - JAW_A
    n = Vector((0.0, -d_ab.z, d_ab.y)).normalized()           # up / forward
    head = smoothstep(-0.006, 0.010, (co - JAW_A).dot(n))
    rest = 1.0 - head
    chest = 1.0 - smoothstep(1.365, 1.405, co.z)
    neck2 = smoothstep(1.425 + 0.6 * S, 1.462 + 0.8 * S, co.z)
    neck1 = max(1.0 - chest - neck2, 0.0)
    side = smoothstep(0.05, 0.11, abs(co.x)) * smoothstep(1.28, 1.33, co.z) * (1.0 - smoothstep(1.385, 1.405, co.z))
    shoulder = 0.7 * side * chest
    w = {"head": head, "neck_02": rest * neck2, "neck_01": rest * neck1,
         "chest": rest * (chest - shoulder), "shoulder.L" if co.x > 0 else "shoulder.R": rest * shoulder}
    total = sum(w.values())
    return {k: v / total for k, v in w.items() if v / total > 1e-4}


def apply_weights(ob, rig):
    for m in [m for m in ob.modifiers if m.type == "ARMATURE"]:
        ob.modifiers.remove(m)
    ob.vertex_groups.clear()
    groups = {b.name: ob.vertex_groups.new(name=b.name) for b in rig.data.bones}
    for v in ob.data.vertices:
        for name, w in sorted(weights_for(v.co).items(), key=lambda kv: -kv[1])[:4]:
            groups[name].add([v.index], w, "REPLACE")
    mod = ob.modifiers.new("Armature", "ARMATURE")
    mod.object = rig
    ob.parent = rig
    ob.matrix_parent_inverse = rig.matrix_world.inverted()


def skin(rig):
    apply_weights(low, rig)
    unweighted = sum(1 for v in low.data.vertices if not v.groups)
    return sorted(g.name for g in low.vertex_groups), unweighted


def parent_eyes(rig):
    for eye in eyes:
        mw = eye.matrix_world.copy()
        eye.parent = rig
        eye.parent_type = "BONE"
        eye.parent_bone = "head"
        bpy.context.view_layer.update()
        eye.matrix_world = mw


def build_proxy(rig):
    proxy = low.copy()
    proxy.data = low.data.copy()
    proxy.name = proxy.data.name = "BUST_proxy"
    bpy.context.scene.collection.objects.link(proxy)
    for m in list(proxy.modifiers):
        proxy.modifiers.remove(m)
    dec = proxy.modifiers.new("Decimate", "DECIMATE")
    dec.decimate_type = "COLLAPSE"
    dec.ratio = PROXY_RATIO
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(proxy.evaluated_get(dg), preserve_all_data_layers=True, depsgraph=dg)
    proxy.modifiers.clear()
    old = proxy.data
    proxy.data = me
    me.name = "BUST_proxy"
    bpy.data.meshes.remove(old)
    while proxy.data.uv_layers:
        proxy.data.uv_layers.remove(proxy.data.uv_layers[0])
    apply_weights(proxy, rig)
    proxy.hide_render = True
    return proxy


pose = C.pose_chain


def main():
    rig, base = build_armature()
    groups, unweighted = skin(rig)
    parent_eyes(rig)
    proxy = build_proxy(rig)
    bpy.ops.object.mode_set(mode="OBJECT") if bpy.context.object and bpy.context.object.mode != "OBJECT" else None
    bpy.ops.wm.save_mainfile(compress=True)

    # deformation tests
    C.setup_gpu()
    C.set_color_management()
    C.black_world()
    for ob in [o for o in bpy.data.objects if o.type in {"LIGHT", "CAMERA"}]:
        bpy.data.objects.remove(ob, do_unlink=True)
    C.poster_light_rig(head=(0.0, -0.03, 1.52))
    cam = C.camera(lens=85)
    center = Vector((0, -0.02, 1.43))
    tests = [("rest", 0, 0, 30), ("left_up", 50, 22, 0), ("right_down", -50, -18, 0),
             ("poster", -40, 25, -140), ("side_up", 0, 28, 90)]
    for label, yaw, pitch, az in tests:
        pose(rig, yaw, pitch)
        C.frame_camera(cam, center, 0.46, azimuth_deg=az, elevation_deg=3)
        C.render_to(os.path.join(C.PREVIEWS, f"rig_{label}.png"), res=(640, 720), samples=40)
    pose(rig, 0, 0)
    bpy.ops.wm.save_mainfile(compress=True)
    C.report(neck_base=list(base), groups=groups, unweighted=unweighted,
             proxy_tris=sum(len(p.vertices) - 2 for p in proxy.data.polygons))


main()
