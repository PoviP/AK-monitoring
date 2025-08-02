# Create Astral Keys Monitor package with installer
Write-Host "Creating Astral Keys Monitor package with installer..." -ForegroundColor Green

# Create directory
if (Test-Path "installer-package") {
    Remove-Item -Recurse -Force "installer-package"
}
New-Item -ItemType Directory -Name "installer-package" | Out-Null

# Create app subfolder
New-Item -ItemType Directory -Name "installer-package\app" | Out-Null

# Copy application files to app subfolder
Write-Host "Copying application files..." -ForegroundColor Yellow
Copy-Item "app\main.js" "installer-package\app\"
Copy-Item "app\renderer.js" "installer-package\app\"
Copy-Item "app\index.html" "installer-package\app\"
Copy-Item "app\styles.css" "installer-package\app\"
Copy-Item "app\settings.html" "installer-package\app\"
Copy-Item "app\icon.png" "installer-package\app\"
Copy-Item "app\service-account.json" "installer-package\app\"
Copy-Item "app\package.json" "installer-package\app\"

# Copy minimal node_modules to app subfolder
Write-Host "Copying minimal node_modules..." -ForegroundColor Yellow
Copy-Item "app\node_modules" "installer-package\app\" -Recurse

# Create install.bat
Write-Host "Creating installer..." -ForegroundColor Yellow
@"
@echo off
echo Astral Keys Monitor - First Time Setup
echo =====================================
echo.
echo This will install Electron globally for this application.
echo This only needs to be done once per computer.
echo.
pause
echo.
echo Installing Electron globally...
npm install -g electron
echo.
echo Installation complete!
echo You can now run the application.
echo.
pause
"@ | Out-File -FilePath "installer-package\install.bat" -Encoding ASCII

# Create debug launcher that checks for Electron
Write-Host "Creating debug launcher..." -ForegroundColor Yellow
@"
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
"@ | Out-File -FilePath "installer-package\Debug - Show Console.bat" -Encoding ASCII

# Create VBS launcher
Write-Host "Creating VBS launcher..." -ForegroundColor Yellow
@"
' Astral Keys Monitor - Launcher with Installer
Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName) & "\app"

' Check if Electron is installed by trying to run it
Set FSO = CreateObject("Scripting.FileSystemObject")
Set objShell = CreateObject("WScript.Shell")

' Try to run electron --version and capture the result
Dim result
result = objShell.Run("cmd /c electron --version", 0, True)

If result <> 0 Then
    ' Electron not found, run installer
    MsgBox "Electron not found. Running first-time setup...", vbInformation, "Astral Keys Monitor"
    WshShell.CurrentDirectory = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
    result = objShell.Run("install.bat", 1, True)
    If result <> 0 Then
        MsgBox "Installation failed. Please run install.bat manually.", vbCritical, "Astral Keys Monitor"
        WScript.Quit 1
    End If
    WshShell.CurrentDirectory = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName) & "\app"
End If

' Start the application
WshShell.Run "electron .", 0, False
"@ | Out-File -FilePath "installer-package\Start Astral Keys Monitor.vbs" -Encoding ASCII

# Create README for the package
@"
Astral Keys Monitor - Installer Package
=======================================

FIRST TIME SETUP:
================

1. Run "install.bat" to install Electron globally
2. This only needs to be done once per computer
3. After installation, use "Start Astral Keys Monitor.vbs" to run the app

USAGE:
======

- install.bat - First-time setup (run once)
- Start Astral Keys Monitor.vbs - Normal launcher (recommended)
- Debug - Show Console.bat - Debug launcher (shows console)

The installer will automatically run if Electron is not found.

FOLDER STRUCTURE:
================

- app/ - Application files and dependencies
- install.bat - First-time setup script
- Start Astral Keys Monitor.vbs - Main launcher
- Debug - Show Console.bat - Debug launcher
- README.txt - This file
"@ | Out-File -FilePath "installer-package\README.txt" -Encoding ASCII

Write-Host "Done! Installer package created in installer-package folder." -ForegroundColor Green
Write-Host "This package includes an installer for first-time setup." -ForegroundColor Green 