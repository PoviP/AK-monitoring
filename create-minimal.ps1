# Create minimal Astral Keys Monitor package
Write-Host "Creating minimal Astral Keys Monitor package..." -ForegroundColor Green

# Create directory
if (Test-Path "portable-package") {
    Remove-Item -Recurse -Force "portable-package"
}
New-Item -ItemType Directory -Name "portable-package" | Out-Null

# Copy application files
Write-Host "Copying application files..." -ForegroundColor Yellow
Copy-Item "app\main.js" "portable-package\"
Copy-Item "app\renderer.js" "portable-package\"
Copy-Item "app\index.html" "portable-package\"
Copy-Item "app\styles.css" "portable-package\"
Copy-Item "app\settings.html" "portable-package\"
Copy-Item "app\icon.png" "portable-package\"
Copy-Item "app\service-account.json" "portable-package\"
Copy-Item "app\package.json" "portable-package\"

# Copy minimal node_modules (production only)
Write-Host "Copying minimal node_modules..." -ForegroundColor Yellow
Copy-Item "app\node_modules" "portable-package\" -Recurse

# Create launcher
Write-Host "Creating launcher..." -ForegroundColor Yellow
@"
@echo off
cd /d "%~dp0"
npx electron . --hidden
"@ | Out-File -FilePath "portable-package\Debug - Show Console.bat" -Encoding ASCII

# Create VBS launcher
@"
' Astral Keys Monitor - Portable Launcher
Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
WshShell.Run "npx electron . --hidden", 0, False
"@ | Out-File -FilePath "portable-package\Start Astral Keys Monitor.vbs" -Encoding ASCII

Write-Host "Done! Minimal package created in portable-package folder." -ForegroundColor Green
Write-Host "Size should be much smaller than the original 700MB." -ForegroundColor Green 