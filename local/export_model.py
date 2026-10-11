import bpy, os
from pathlib import Path
bpy.ops.wm.open_mainfile(filepath=str(Path(__file__).resolve().parents[2] / 'output/lake_model/lake_scene_traced.blend'))
# The .blend stays unchanged. Export only visible meshes, with modifiers applied.
for ob in list(bpy.data.objects):
 if ob.type!='MESH' or ob.hide_get() or any(c.hide_viewport for c in ob.users_collection): bpy.data.objects.remove(ob,do_unlink=True)
# Combine objects with the same material slots to reduce browser draw calls.
groups={}
for ob in list(bpy.data.objects):
 for mod in list(ob.modifiers):
  bpy.context.view_layer.objects.active=ob
  bpy.ops.object.modifier_apply(modifier=mod.name)
 groups.setdefault(tuple(m.name for m in ob.data.materials),[]).append(ob)
for key,objects in groups.items():
 bpy.ops.object.select_all(action='DESELECT')
 for ob in objects: ob.select_set(True)
 bpy.context.view_layer.objects.active=objects[0]
 if len(objects)>1: bpy.ops.object.join()
# Node noise bump is a Blender shader; retain the exact geometry and base PBR colors.
bpy.ops.export_scene.gltf(filepath=os.path.join(os.path.dirname(__file__),'../assets/lake.glb'),export_format='GLB',export_cameras=False,export_lights=False,export_apply=True,export_yup=True)
print('Browser model exported.')
