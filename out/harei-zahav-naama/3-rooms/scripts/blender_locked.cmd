@echo off
rem Blender under the machine-wide lock, for drivers that call Blender directly (the day-night-keyframes skill --blender)
python "%~dp0run_blender.py" --wait 3000 --timeout 900 -- %*
