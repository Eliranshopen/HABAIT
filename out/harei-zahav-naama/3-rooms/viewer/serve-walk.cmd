@echo off
rem Serves this job folder on http://127.0.0.1:8894 and opens the 3D walkaround (a browser cannot load the model from file://)
cd /d "%~dp0.."
start "" http://127.0.0.1:8894/walkaround/
python -m http.server 8894 --bind 127.0.0.1
