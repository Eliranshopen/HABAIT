"""habait-engine video (card 35): the demo's recipe as an engine stage.

flat clay video (Blender, the traced geometry, camera.json per frame) -> ONE Kling 4.0 v2v edit call (@Video1 = the clay,
@Image1.. = reference images) -> a photoreal flat video whose camera is the clay's camera, mapped onto the real frames.

  media.py       ffmpeg / ffprobe: probe, cut, decode to numpy, extract first / last / per-frame JPEGs
  camera_map.py  real frame <-> clay frame mapping, camera.json for the REAL frames (matrix_world + fov per frame)
  kling_v2v.py   the paid call: limits, estimate, cache by sha256(clay, refs, prompt, params), prompt templates, fal backend
  track_gate.py  $0 gate: does the real video follow the clay under the mapping? (edge agreement, best-offset test)
  manifest.py    <project>/video/manifest.json (habait-engine/video.v1): build + validate
  spec.py        <project>/video/segments.json (the per-project segment list) or a default derived from project.json
The stage wrapper is Habait/engine/stages/video.py; the test is Habait/engine/test/test_video_stage.py.
"""
