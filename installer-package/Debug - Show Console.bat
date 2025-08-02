@echo off
cd /d "%~dp0\app"
echo Checking for Electron installation...
electron --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Electron not found. Running installer...
    cd /d "%~dp0"
    call install.bat
    if %errorlevel% neq 0 (
        echo Installation failed. Please run install.bat manually.
        pause
        exit /b 1
    )
    cd /d "%~dp0\app"
)
echo Starting Astral Keys Monitor...
electron .
