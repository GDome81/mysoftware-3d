import bpy
import sys
import os

fbx_path = sys.argv[-2]
glb_path = sys.argv[-1]

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=fbx_path)
bpy.ops.export_scene.gltf(filepath=glb_path, export_format='GLB')
