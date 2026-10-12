"""Cycles preview of BUST_low with the baked masters applied (quality check, not for export)."""
import os
import sys

sys.path.append(os.path.dirname(__file__))
import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402

import common as C  # noqa: E402

tag = (C.script_args() or ["4k"])[0]
low = bpy.data.objects["BUST_low"]
eyes = [bpy.data.objects["EYE_L"], bpy.data.objects["EYE_R"]]
bpy.data.objects["BUST_high"].hide_render = True


def load(name):
    img = bpy.data.images.load(os.path.join(C.BAKES, f"{name}_{tag}.png"), check_existing=True)
    img.colorspace_settings.name = "Non-Color"
    return img


mat = bpy.data.materials.new("M_PreviewTextured")
mat.use_nodes = True
nt = mat.node_tree
bsdf = nt.nodes["Principled BSDF"]
bsdf.inputs["Base Color"].default_value = (0.010, 0.011, 0.015, 1.0)
bsdf.inputs["Coat Weight"].default_value = 1.0
bsdf.inputs["Coat Roughness"].default_value = 0.07
nmap = nt.nodes.new("ShaderNodeNormalMap")
ntex = nt.nodes.new("ShaderNodeTexImage")
ntex.image = load("normal")
ntex.interpolation = "Cubic"
nt.links.new(ntex.outputs["Color"], nmap.inputs["Color"])
nt.links.new(nmap.outputs["Normal"], bsdf.inputs["Normal"])
nt.links.new(nmap.outputs["Normal"], bsdf.inputs["Coat Normal"])
otex = nt.nodes.new("ShaderNodeTexImage")
otex.image = load("orm")
sep = nt.nodes.new("ShaderNodeSeparateColor")
nt.links.new(otex.outputs["Color"], sep.inputs["Color"])
nt.links.new(sep.outputs["Green"], bsdf.inputs["Roughness"])
low.data.materials.clear()
low.data.materials.append(mat)

eye_mat = C.obsidian_material("M_EyePreview")
for e in eyes:
    e.data.materials.clear()
    e.data.materials.append(eye_mat)

C.setup_gpu()
C.set_color_management()
C.black_world()
for ob in [o for o in bpy.data.objects if o.type in {"LIGHT", "CAMERA"}]:
    bpy.data.objects.remove(ob, do_unlink=True)
C.poster_light_rig(head=(0.0, -0.03, 1.52))
cam = C.camera(lens=85)
shots = [
    ("q", Vector((0, -0.02, 1.43)), 0.44, 35, 4),
    ("poster", Vector((0, -0.02, 1.43)), 0.44, -140, 4),
    ("face", Vector((0.0, -0.10, 1.50)), 0.17, 25, 2),
    ("ear", Vector((0.07, -0.04, 1.51)), 0.09, 80, 0),
]
for label, center, height, az, el in shots:
    C.frame_camera(cam, center, height, azimuth_deg=az, elevation_deg=el)
    C.render_to(os.path.join(C.PREVIEWS, f"tex_{label}.png"), res=(800, 900), samples=96)
C.report(rendered=[s[0] for s in shots])
