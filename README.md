# Astral Keys Monitor

A desktop application that automatically monitors your World of Warcraft AstralKeys.lua file and uploads key information to Google Sheets.

## Features

- **Automatic File Monitoring**: Watches your AstralKeys.lua file for changes
- **Google Sheets Integration**: Automatically uploads key data to a shared spreadsheet
- **System Tray Support**: Runs in the background with system tray icon
- **Auto-Start**: Can be configured to start automatically on Windows boot
- **Multi-User Support**: Preserves other users' data when updating the spreadsheet
- **Real-time Logging**: Built-in logging system with settings window
- **Silent Operation**: Runs completely silently without console windows

## Requirements

- Windows 10/11
- Node.js (for development)
- Internet connection for Google Sheets upload

## Development Setup

1. Clone this repository
2. Install dependencies: `npm install`
3. Start the application: `npm start`

## Building Distribution Packages

### Portable Package (No Installation Required)
```powershell
powershell -ExecutionPolicy Bypass -File create-minimal.ps1
```
Creates a `portable-package` folder that works immediately but downloads Electron on first run.

### Installer Package (Recommended for Distribution)
```powershell
powershell -ExecutionPolicy Bypass -File create-with-installer.ps1
```
Creates an `installer-package` folder with an `install.bat` for first-time setup.

## Distribution

The application can be built into two types of packages:

### Portable Package
- `Start Astral Keys Monitor.vbs` - Main launcher (recommended)
- `Debug - Show Console.bat` - Debug launcher with console window
- Works immediately but downloads Electron on first run

### Installer Package
- `install.bat` - First-time setup (installs Electron globally)
- `Start Astral Keys Monitor.vbs` - Smart launcher (checks for Electron)
- `Start Astral Keys Monitor.bat` - Debug launcher
- Requires one-time setup but runs instantly afterward

## Usage

1. Extract the standalone package
2. Double-click any of the launcher files
3. Select your AstralKeys.lua file when prompted
4. The app will automatically monitor the file and upload to Google Sheets

## Configuration

- **Google Sheets**: Requires `service-account.json` file for API access
- **Auto-Start**: Configure via the system tray menu
- **Settings**: Access via "Settings & Logs" in the system tray menu

## File Structure

```
├── main.js                 # Main Electron process
├── renderer.js             # Renderer process logic
├── index.html              # Main application UI
├── styles.css              # Application styling
├── settings.html           # Settings and logs window
├── icon.png                # Application icon
├── service-account.json    # Google Sheets credentials
├── package.json            # Application configuration
└── dist-standalone/        # Distribution package
    ├── app/                # Application files
    └── *.vbs/*.bat/*.ps1  # Launcher scripts
```

## Technical Details

- Built with Electron for cross-platform desktop support
- Uses `chokidar` for file watching
- `electron-store` for persistent settings
- `googleapis` for Google Sheets integration
- Lua file parsing for AstralKeys addon data
- Week-based timestamp parsing for accurate date conversion
