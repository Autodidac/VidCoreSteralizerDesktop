@echo off
setlocal
cd /d "%~dp0"

call validate.bat
if errorlevel 1 exit /b %errorlevel%

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\bootstrap.ps1"
if errorlevel 1 exit /b %errorlevel%

cmake --build --preset release --parallel
if errorlevel 1 exit /b %errorlevel%

echo.
echo Built: build\Release\VidCoreNativePlayer.exe
