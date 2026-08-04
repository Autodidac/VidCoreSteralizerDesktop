@echo off
setlocal
cd /d "%~dp0"
start "VidCore Web Player Server" cmd /k py -m http.server 8080
start "" http://localhost:8080/
