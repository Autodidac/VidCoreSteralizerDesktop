@echo off
setlocal
cd /d "%~dp0"

if not exist "build\Release\VidCoreNativePlayer.exe" (
    call build.bat
    if errorlevel 1 exit /b %errorlevel%
)

start "" "build\Release\VidCoreNativePlayer.exe"
