@echo off
REM Windows launcher for bootstrap-windows.ps1
setlocal
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0bootstrap-windows.ps1" %*
endlocal
