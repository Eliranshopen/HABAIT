p = 'scripts/blender/optimize_glb.py'
s = open(p, encoding='utf-8').read()
s = s.replace('src = os.path.join(JOB, "items", "glb", IID + ".glb")\nout = os.path.join(JOB, "walkaround", "items", "glb", IID + ".glb")',
              'SUF = opt("--suffix", "")   # "_m" = the phone copy (fewer faces, smaller maps)\nsrc = os.path.join(JOB, "items", "glb", IID + ".glb")\nout = os.path.join(JOB, "walkaround", "items", "glb", IID + SUF + ".glb")')
s = s.replace('bpy.ops.export_scene.gltf(filepath=out, export_format="GLB", use_selection=True, export_image_format="JPEG",\n                          export_jpeg_quality=86, export_yup=True, export_apply=True)',
              'bpy.ops.export_scene.gltf(filepath=out, export_format="GLB", use_selection=True, export_image_format="JPEG",\n                          export_jpeg_quality=int(opt("--q", "90")), export_yup=True, export_apply=True)\nif "--nopreview" in a:\n    print("OPT OK", json.dumps({"id": IID + SUF, "faces_before": before, "faces_after": sum(len(o.data.polygons) for o in meshes), "bytes_out": os.path.getsize(out)}))\n    raise SystemExit(0)')
open(p, 'w', encoding='utf-8').write(s)
print('ok', s.count('SUF'))
