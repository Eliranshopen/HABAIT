@echo off
rem Double-click this file on the OTHER computer. It restores C:\RnD from this folder (see README-HE.md).
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0restore.ps1" %*
echo.
pause
