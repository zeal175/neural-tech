"""Print a summary of every object in the Human Base Meshes bundle (read-only)."""
import bpy
import json

out = []
for ob in bpy.data.objects:
    info = {
        "name": ob.name,
        "type": ob.type,
        "dims": [round(v, 3) for v in ob.dimensions],
        "loc": [round(v, 3) for v in ob.location],
        "parent": ob.parent.name if ob.parent else None,
        "collections": [c.name for c in ob.users_collection],
        "asset": ob.asset_data is not None,
    }
    if ob.type == "MESH":
        me = ob.data
        info.update(
            verts=len(me.vertices),
            faces=len(me.polygons),
            uv_layers=[uv.name for uv in me.uv_layers],
            attributes=[a.name for a in me.attributes if not a.name.startswith(".")],
            materials=[m.name if m else None for m in me.materials],
            shape_keys=[k.name for k in me.shape_keys.key_blocks] if me.shape_keys else [],
        )
        mods = []
        for m in ob.modifiers:
            d = {"name": m.name, "type": m.type}
            if m.type == "MULTIRES":
                d.update(levels=m.levels, sculpt=m.sculpt_levels, render=m.render_levels, total=m.total_levels)
            if m.type == "SUBSURF":
                d.update(levels=m.levels, render=m.render_levels)
            mods.append(d)
        info["modifiers"] = mods
        if me.uv_layers:
            us = [l.uv for l in me.uv_layers.active.data]
            info["uv_range"] = [
                round(min(u.x for u in us), 2), round(max(u.x for u in us), 2),
                round(min(u.y for u in us), 2), round(max(u.y for u in us), 2),
            ]
    out.append(info)

print("@@JSON@@" + json.dumps({"file": bpy.data.filepath, "version": bpy.app.version_string,
                              "objects": out,
                              "collections": [c.name for c in bpy.data.collections]}))
