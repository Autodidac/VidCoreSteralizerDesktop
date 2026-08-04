@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
    echo Node.js was not found. Static JavaScript validation was skipped.
    exit /b 0
)

node --check assets\storage.js
if errorlevel 1 exit /b %errorlevel%

node --check assets\builtin-library.js
if errorlevel 1 exit /b %errorlevel%

node --check assets\metadata.js
if errorlevel 1 exit /b %errorlevel%

node --check assets\providers.js
if errorlevel 1 exit /b %errorlevel%

node --check assets\scanner.js
if errorlevel 1 exit /b %errorlevel%

node --check assets\app.js
if errorlevel 1 exit /b %errorlevel%

node tests\static-smoke.test.mjs
if errorlevel 1 exit /b %errorlevel%

node tests\logic.test.mjs
if errorlevel 1 exit /b %errorlevel%

node tests\providers.test.mjs
if errorlevel 1 exit /b %errorlevel%

node tests\builtin-library.test.mjs
if errorlevel 1 exit /b %errorlevel%

node tests\storage-format.test.mjs
if errorlevel 1 exit /b %errorlevel%

echo Validation passed.
