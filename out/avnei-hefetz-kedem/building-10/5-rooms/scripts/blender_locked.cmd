@echo off
rem Blender under the machine-wide lock (blender_run.py): the skill's walk_keyframes.py calls this as --blender
python "%~dp0blender_run.py" --wait 3600 -- %*
