"""Export the rigged bust (mesh + eyes + raycast proxy + skeleton) to glTF binary.

Textures are not embedded: the web app loads the baked maps itself (progressive 2K -> 4K),
so the GLB stays geometry + skin only. Output: blender/export/enclave_bust_raw.glb
"""
import os
import sys

sys.path.append(os.path.dirname(__file__))
import bpy  # noqa: E402
from mathutils import Quaternion  # noqa: E402

import common as C  # noqa: E402

EXPORT_DIR = os.path.join(C.BLENDER_DIR, "export")
os.makedirs(EXPORT_DIR, exist_ok=True)
OUT = os.path.join(EXPORT_DIR, "enclave_bust_raw.glb")

rig = bpy.data.objects["RIG"]
low = bpy.data.objects["BUST_low"]
proxy = bpy.data.objects["BUST_proxy"]
eyes = [bpy.data.objects["EYE_L"], bpy.data.objects["EYE_R"]]

def triangulate_ngons(ob):
    """MikkTSpace tangents need tris/quads; the bisect cut leaves a few n-gons along its edge.
    Splitting them adds no vertices, so UVs, weights and the baked maps stay valid."""
    import bmesh

    bm = bmesh.new()
    bm.from_mesh(ob.data)
    ngons = [f for f in bm.faces if len(f.verts) > 4]
    if ngons:
        bmesh.ops.triangulate(bm, faces=ngons, quad_method="BEAUTY", ngon_method="BEAUTY")
        bm.to_mesh(ob.data)
    bm.free()
    return len(ngons)


ngons = {ob.name: triangulate_ngons(ob) for ob in (low, proxy)}

for pb in rig.pose.bones:
    pb.rotation_mode = "QUATERNION"
    pb.rotation_quaternion = Quaternion()
    pb.location = (0, 0, 0)
    pb.scale = (1, 1, 1)
bpy.context.view_layer.update()


def simple_material(name, color, rough):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Roughness"].default_value = rough
    return mat


for ob, mat in ((low, simple_material("M_Bust", (0.01, 0.011, 0.015), 0.25)),
                (proxy, simple_material("M_Proxy", (1, 0, 1), 1.0))):
    ob.data.materials.clear()
    ob.data.materials.append(mat)
eye_mat = simple_material("M_Eye", (0.006, 0.006, 0.008), 0.05)
for e in eyes:
    e.data.materials.clear()
    e.data.materials.append(eye_mat)

# metadata the web app reads from node extras
low["enclave"] = {"cut_front": list(low.get("cut_front", [])), "cut_back": list(low.get("cut_back", [])),
                  "eye_L": list(low.get("eye_L", [])), "eye_R": list(low.get("eye_R", []))}

for ob in bpy.data.objects:
    ob.hide_set(False)
    ob.select_set(ob in (rig, low, proxy, *eyes))
bpy.context.view_layer.objects.active = rig

bpy.ops.export_scene.gltf(
    filepath=OUT,
    export_format="GLB",
    use_selection=True,
    export_yup=True,
    export_apply=False,
    export_texcoords=True,
    export_normals=True,
    export_tangents=True,
    export_materials="EXPORT",
    export_image_format="NONE",
    export_skins=True,
    export_influence_nb=4,
    export_all_influences=False,
    export_def_bones=False,
    export_animations=False,
    export_morph=False,
    export_extras=True,
    export_cameras=False,
    export_lights=False,
)
size = os.path.getsize(OUT)
bpy.ops.wm.save_mainfile(compress=True)
C.report(out=OUT, mb=round(size / 1e6, 2), ngons_split=ngons, low_verts=len(low.data.vertices),
         proxy_verts=len(proxy.data.vertices))
