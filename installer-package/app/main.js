const { app, BrowserWindow, ipcMain, dialog, Tray, Menu, nativeImage } = require('electron')
const path = require('path')
const fs = require('fs')
const chokidar = require('chokidar')
const Store = require('electron-store')
const { google } = require('googleapis')
const os = require('os')

// Auto-start functionality
const { exec } = require('child_process')

// Logging system
let logs = []
const maxLogs = 1000

function addLog(message, type = 'info') {
  const timestamp = new Date().toISOString()
  const logEntry = {
    timestamp,
    type,
    message,
    id: Date.now() + Math.random()
  }
  
  logs.unshift(logEntry)
  
  // Keep only the last maxLogs entries
  if (logs.length > maxLogs) {
    logs = logs.slice(0, maxLogs)
  }
  
  // Also log to console for debugging
  console.log(`[${timestamp}] [${type.toUpperCase()}] ${message}`)
  
  return logEntry
}

const store = new Store()

let mainWindow
let settingsWindow
let tray
let fileWatcher

// Auto-start functions using startup folder (safest approach)
function setAutoStart(enable) {
  if (process.platform === 'win32') {
    const startupFolder = path.join(process.env.APPDATA, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup')
    const shortcutPath = path.join(startupFolder, 'AstralKeysMonitor.lnk')
    
    if (enable) {
      // Create a batch file that starts the app with correct working directory
      // Always use the current working directory where the app is located
      const appPath = process.cwd()
      
      // For development, use npx electron
      // For production, use the VBS launcher approach
      let startCommand
      if (process.env.NODE_ENV === 'development') {
        startCommand = `npx electron . --hidden`
      } else {
        // In production, create a VBS launcher that works reliably
        const vbsContent = `' Astral Keys Monitor - Auto Start
Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "${appPath.replace(/\\/g, '\\\\')}"
WshShell.Run "npx electron . --hidden", 0, False`
        
        const vbsPath = path.join(startupFolder, 'AstralKeysMonitor.vbs')
        try {
          fs.writeFileSync(vbsPath, vbsContent)
          console.log('Auto-start enabled via VBS launcher')
          return
        } catch (error) {
          console.error('Error creating VBS launcher:', error)
        }
      }
      
      const batchContent = `@echo off
cd /d "${appPath}"
${startCommand}`
      const batchPath = path.join(startupFolder, 'AstralKeysMonitor.bat')
      
      try {
        // Ensure startup folder exists
        if (!fs.existsSync(startupFolder)) {
          fs.mkdirSync(startupFolder, { recursive: true })
        }
        
        // Write the batch file
        fs.writeFileSync(batchPath, batchContent)
        console.log('Auto-start enabled via startup folder')
      } catch (error) {
        console.error('Error setting auto-start:', error)
      }
    } else {
      // Remove both batch and VBS files
      const batchPath = path.join(startupFolder, 'AstralKeysMonitor.bat')
      const vbsPath = path.join(startupFolder, 'AstralKeysMonitor.vbs')
      try {
        if (fs.existsSync(batchPath)) {
          fs.unlinkSync(batchPath)
        }
        if (fs.existsSync(vbsPath)) {
          fs.unlinkSync(vbsPath)
        }
        console.log('Auto-start disabled')
      } catch (error) {
        console.error('Error removing auto-start:', error)
      }
    }
  }
}

// Function to update existing auto-start files to ensure they use --hidden
function updateAutoStartFiles() {
  if (process.platform === 'win32') {
    const startupFolder = path.join(process.env.APPDATA, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup')
    const vbsPath = path.join(startupFolder, 'AstralKeysMonitor.vbs')
    
    if (fs.existsSync(vbsPath)) {
      try {
        const content = fs.readFileSync(vbsPath, 'utf8')
        // Check if the file doesn't have --hidden flag
        if (!content.includes('--hidden')) {
          const appPath = process.cwd()
          const vbsContent = `' Astral Keys Monitor - Auto Start
Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "${appPath.replace(/\\/g, '\\\\')}"
WshShell.Run "npx electron . --hidden", 0, False`
          
          fs.writeFileSync(vbsPath, vbsContent)
          console.log('Updated existing auto-start file to use --hidden flag')
        }
      } catch (error) {
        console.error('Error updating auto-start file:', error)
      }
    }
  }
}

function isAutoStartEnabled() {
  if (process.platform === 'win32') {
    const startupFolder = path.join(process.env.APPDATA, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup')
    const batchPath = path.join(startupFolder, 'AstralKeysMonitor.bat')
    const vbsPath = path.join(startupFolder, 'AstralKeysMonitor.vbs')
    return fs.existsSync(batchPath) || fs.existsSync(vbsPath)
  }
  return store.get('autoStart', false)
}

// Lua file parser
function parseAstralKeysLua(filePath) {
  try {
    addLog(`Parsing Lua file: ${filePath}`)
    const content = fs.readFileSync(filePath, 'utf8')
    addLog(`Raw file content: ${content.substring(0, 500)}...`)
    
    const entries = []
    
    // Simple approach: find all lines with the key fields
    const lines = content.split('\n')
    
         for (let i = 0; i < lines.length; i++) {
       const line = lines[i].trim()
       
       // Look for lines that start with { (entry start)
       if (line === '{') {
        console.log('Found potential entry starting at line:', i + 1)
        
        // Collect all lines until we find the closing }
        let entryText = line
        let j = i + 1
        let braceCount = 1 // We already have one opening brace
        
        while (j < lines.length && braceCount > 0) {
          const nextLine = lines[j].trim()
          entryText += '\n' + nextLine
          
          // Count braces
          for (const char of nextLine) {
            if (char === '{') braceCount++
            if (char === '}') braceCount--
          }
          
          j++
        }
        
        console.log('Complete entry:', entryText)
        
                 // Extract the fields
         const unitMatch = entryText.match(/\["unit"\]\s*=\s*"([^"]+)"/)
         const keyLevelMatch = entryText.match(/\["key_level"\]\s*=\s*(\d+)/)
         const dungeonIdMatch = entryText.match(/\["dungeon_id"\]\s*=\s*(\d+)/)
         const timeStampMatch = entryText.match(/\["time_stamp"\]\s*=\s*(\d+)/)
         const weekMatch = entryText.match(/\["week"\]\s*=\s*(\d+)/)
         
         console.log('Matches:', {
           unit: unitMatch ? unitMatch[1] : 'NOT FOUND',
           keyLevel: keyLevelMatch ? keyLevelMatch[1] : 'NOT FOUND',
           dungeonId: dungeonIdMatch ? dungeonIdMatch[1] : 'NOT FOUND',
           timeStamp: timeStampMatch ? timeStampMatch[1] : 'NOT FOUND',
           week: weekMatch ? weekMatch[1] : 'NOT FOUND'
         })
         
         if (unitMatch && keyLevelMatch && dungeonIdMatch && timeStampMatch) {
           const character_name = unitMatch[1]
           const key_level = parseInt(keyLevelMatch[1])
           const dungeon_id = parseInt(dungeonIdMatch[1])
           const wow_timestamp = timeStampMatch[1]
           const week = weekMatch ? parseInt(weekMatch[1]) : 419 // Default to 419 if not found
           
           // Parse timestamp using the week number from the data
           const parsedTimestamp = parseWowTimestamp(wow_timestamp, week)
           
           // Determine source (friends vs guild)
           // Look for guild-related fields in the entry
           const guildMatch = entryText.match(/\["guild"\]\s*=\s*"([^"]+)"/)
           const isGuildMember = guildMatch && guildMatch[1] !== ''
           const source = isGuildMember ? 'guild' : 'friends'
          
          entries.push({
            character_name,
            key_level,
            dungeon_id,
            wow_timestamp,
            parsed_timestamp: parsedTimestamp,
            dungeon_name: getDungeonName(dungeon_id),
            source: source
          })
          
          console.log(`Added entry: ${character_name} - Level ${key_level} - ${getDungeonName(dungeon_id)} - Timestamp: ${parsedTimestamp}`)
        }
        
        // Skip to the end of this entry
        i = j - 1
      }
    }
    
    console.log(`Parsed ${entries.length} keys from Lua file`)
    return entries
  } catch (error) {
    console.error('Error parsing Lua file:', error)
    return []
  }
}

// Parse WoW timestamp using AstralKeys addon's week-based system
function parseWowTimestamp(timestamp, week = 419) {
  const ts = parseInt(timestamp)
  console.log(`Parsing timestamp: ${timestamp} (${ts}) for week: ${week}`)
  
  // AstralKeys uses region-specific base epochs
  // Based on the addon code, these are the base epochs for different regions:
  const baseEpochs = {
    1: 1500390000, // US Tuesday at reset
    2: 1500447600, // EU Wednesday at reset  
    3: 1500505200  // TW Thursday at reset
  }
  
  // For now, let's use EU (region 2) as default since that's most common
  const baseEpoch = baseEpochs[2] // EU Wednesday at reset
  
  // Calculate the start of the current week
  // Week 419 means 419 weeks have passed since the base epoch
  const weekStartSeconds = baseEpoch + (week * 604800) // 604800 = seconds in a week
  
  // The timestamp is seconds since the start of this week
  const actualDate = new Date((weekStartSeconds + ts) * 1000)
  
  console.log(`Base epoch (EU): ${new Date(baseEpoch * 1000).toISOString()}`)
  console.log(`Week ${week} start: ${new Date(weekStartSeconds * 1000).toISOString()}`)
  console.log(`Seconds since week start: ${ts}`)
  console.log(`Calculated date: ${actualDate.toISOString()}`)
  
  return actualDate.toISOString()
}

// Deduplicate entries - keep only the most recent for each character
function deduplicateEntries(entries) {
  const characterMap = new Map()
  
  for (const entry of entries) {
    const key = entry.character_name
    const existing = characterMap.get(key)
    
    // Compare using the original wow_timestamp (as integer) like the Python script
    const currentTimestamp = parseInt(entry.wow_timestamp)
    const existingTimestamp = existing ? parseInt(existing.wow_timestamp) : 0
    
    if (!existing || currentTimestamp > existingTimestamp) {
      characterMap.set(key, entry)
    }
  }
  
  return Array.from(characterMap.values())
}

function getDungeonName(id) {
  const dungeonNames = {
    // Dragonflight Season 4
    370: "Operation: Mechagon - Workshop",
    382: "Theater of Pain", 
    499: "Priory of the Sacred Flame",
    500: "The Rookery",
    504: "Darkflame Cleft",
    506: "Cinderbrew Meadery",
    525: "Operation: Floodgate",
    247: "The MOTHERLODE!!",
    // Additional dungeons that might appear
    375: "Mists of Tirna Scithe",
    377: "De Other Side",
    378: "Halls of Atonement",
    379: "Plaguefall",
    380: "Sanguine Depths",
    381: "Spires of Ascension",
    383: "Necrotic Wake",
    384: "Pit of Saron",
    385: "Halls of Reflection",
    386: "Forge of Souls",
  }
  return dungeonNames[id] || `Unknown (${id})`
}

// Save data to local JSON file
async function saveData(entries) {
  try {
    // Deduplicate entries to keep only the most recent for each character
    const deduplicatedEntries = deduplicateEntries(entries)
    
    const data = {
      last_updated: new Date().toISOString(),
      entries: deduplicatedEntries
    }
    
    const outputPath = path.join(app.getPath('userData'), 'astral_keys_data.json')
    fs.writeFileSync(outputPath, JSON.stringify(data, null, 2))
    
    console.log(`Updated ${deduplicatedEntries.length} keys (deduplicated from ${entries.length})`)
    
    // Also send to Google Sheets
    await sendToGoogleSheets(deduplicatedEntries)
    
    return true
  } catch (error) {
    console.error('Error saving data:', error)
    return false
  }
}

// Google Sheets integration
async function sendToGoogleSheets(entries) {
  try {
    addLog(`Starting Google Sheets export for ${entries.length} entries`)
    
    // Load service account credentials
    const serviceAccountPath = path.join(__dirname, 'service-account.json')
    addLog(`Loading service account from: ${serviceAccountPath}`)
    
    if (!fs.existsSync(serviceAccountPath)) {
      throw new Error('Service account file not found. Please ensure service-account.json exists in the app directory.')
    }
    
    const credentials = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'))
    console.log('Service account loaded, client email:', credentials.client_email)
    
    // Create JWT client with proper authentication
    const auth = new google.auth.GoogleAuth({
      keyFile: serviceAccountPath,
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    })
    
    console.log('Authorizing Google Auth client...')
    // Get the authenticated client
    const authClient = await auth.getClient()
    console.log('Google Auth client authorized successfully')
    
    // Create Google Sheets API client
    const sheets = google.sheets({ version: 'v4', auth: authClient })
    
    // Get computer name for source tracking
    const computerName = os.hostname()
    
    // Prepare data for spreadsheet (Column A: Character, B: Key Level, C: Dungeon, D: Timestamp, E: Source)
    const rows = entries.map(entry => [
      entry.character_name,
      entry.key_level.toString(),
      entry.dungeon_name,
      entry.parsed_timestamp,
      computerName
    ])
    
    // Your spreadsheet ID
    const spreadsheetId = '1TkcGBmRctSwMJTHXgfl9WZEgj-7l6IWFIYD7ipqC4Y4'
    const range = 'Sheet1!A:E' // Adjust sheet name and range as needed
    
    console.log('Attempting to read existing data...')
    
    // Read existing data to see what's already there
    const existingData = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Sheet1!A:E'
    })
    
    const existingRows = existingData.data.values || []
    console.log(`Found ${existingRows.length} existing rows in spreadsheet`)
    
    // Create a map of existing entries by character name
    const existingEntries = new Map()
    for (const row of existingRows) {
      if (row.length >= 1) {
        const characterName = row[0]
        existingEntries.set(characterName, row)
      }
    }
    
    // Prepare new/updated entries and track which ones need to be replaced
    const newRows = []
    const rowsToReplace = []
    const rowsToDelete = []
    
    for (const entry of entries) {
      const existingRow = existingEntries.get(entry.character_name)
      const newRow = [
        entry.character_name,
        entry.key_level.toString(),
        entry.dungeon_name,
        entry.parsed_timestamp,
        computerName
      ]
      
      // If this character doesn't exist, add it as new
      if (!existingRow) {
        newRows.push(newRow)
        console.log(`Will add new entry for ${entry.character_name}`)
      } 
      // If our timestamp is newer, replace the existing entry
      else if (new Date(entry.parsed_timestamp) > new Date(existingRow[3])) {
        rowsToReplace.push({
          row: newRow,
          existingRowIndex: existingRows.findIndex(row => row[0] === entry.character_name) + 1 // +1 because sheets are 1-indexed
        })
        console.log(`Will replace entry for ${entry.character_name} (newer timestamp)`)
      } else {
        console.log(`Skipping ${entry.character_name} - existing entry is newer`)
      }
    }
    
    // First, replace existing entries that need updating
    for (const replacement of rowsToReplace) {
      console.log(`Replacing row ${replacement.existingRowIndex} for ${replacement.row[0]}...`)
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `Sheet1!A${replacement.existingRowIndex}:E${replacement.existingRowIndex}`,
        valueInputOption: 'RAW',
        resource: {
          values: [replacement.row]
        }
      })
    }
    
    // Then append any completely new entries
    if (newRows.length > 0) {
      console.log(`Attempting to append ${newRows.length} new entries...`)
      
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: 'Sheet1!A:E',
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        resource: {
          values: newRows
        }
      })
      
      console.log(`Successfully added ${newRows.length} new entries to Google Sheets`)
    }
    
    const totalUpdated = rowsToReplace.length + newRows.length
    if (totalUpdated > 0) {
      console.log(`Successfully updated ${totalUpdated} entries (${rowsToReplace.length} replaced, ${newRows.length} added)`)
    } else {
      console.log('No entries to update - all existing entries are up to date')
    }
    
    console.log(`Successfully sent ${entries.length} keys to Google Sheets`)
    return true
  } catch (error) {
    console.error('Error sending to Google Sheets:', error)
    throw error // Re-throw so the UI can show the error
  }
}

// Memory optimization: Debounce file parsing
let parseTimeout = null
const PARSE_DEBOUNCE_MS = 500

// Google Sheets cleanup: Remove old keys (older than weekly reset)
async function cleanupOldKeysFromSheets() {
  try {
    addLog('Cleaning up old keys from Google Sheets...')
    
    const { google } = require('googleapis')
    const auth = new google.auth.GoogleAuth({
      keyFile: 'service-account.json',
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    })
    
    const sheets = google.sheets({ version: 'v4', auth })
    const spreadsheetId = store.get('googleSheetsId')
    
    if (!spreadsheetId) {
      addLog('No Google Sheets ID configured, skipping cleanup')
      return
    }
    
    // Get current week number (WoW reset is Tuesday for US)
    const now = new Date()
    const currentWeek = Math.floor((now.getTime() - 1500390000000) / (7 * 24 * 60 * 60 * 1000))
    
    // Read existing data
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'A:D'
    })
    
    const rows = response.data.values || []
    if (rows.length <= 1) return // Only header row
    
    // Filter out old entries (older than current week)
    const currentData = rows.filter((row, index) => {
      if (index === 0) return true // Keep header
      
      const timestamp = parseInt(row[3]) // Assuming timestamp is in column D
      if (!timestamp) return true // Keep if no timestamp
      
      const entryWeek = Math.floor((timestamp * 1000 - 1500390000000) / (7 * 24 * 60 * 60 * 1000))
      return entryWeek >= currentWeek - 1 // Keep current and previous week
    })
    
    // Clear and rewrite data
    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: 'A:D'
    })
    
    if (currentData.length > 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: 'A1',
        valueInputOption: 'RAW',
        resource: { values: currentData }
      })
    }
    
    addLog(`Cleaned up ${rows.length - currentData.length} old entries from Google Sheets`)
  } catch (error) {
    addLog(`Error cleaning up Google Sheets: ${error.message}`, 'error')
  }
}

// Enhanced error handling for file operations
function handleFileError(operation, error) {
  const errorMessage = `Error during ${operation}: ${error.message}`
  addLog(errorMessage, 'error')
  
  // Send error to renderer for toast notification
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('show-error', {
      title: 'File Operation Failed',
      message: errorMessage
    })
  }
  
  return errorMessage
}

// Memory-optimized file watching
function startFileWatching(filePath) {
  if (fileWatcher) {
    fileWatcher.close()
  }
  
  addLog(`Starting to watch: ${filePath}`)
  
  fileWatcher = chokidar.watch(filePath, {
    persistent: true,
    ignoreInitial: false,
    awaitWriteFinish: {
      stabilityThreshold: 2000,
      pollInterval: 100
    }
  })
  
  fileWatcher.on('change', (path) => {
    addLog(`File changed: ${path}`)
    
    // Clear existing timeout
    if (parseTimeout) {
      clearTimeout(parseTimeout)
    }
    
    // Debounce parsing to avoid multiple rapid parses
    parseTimeout = setTimeout(() => {
      addLog('=== STARTING PARSE ===')
      try {
        const entries = parseAstralKeysLua(path)
        addLog(`=== PARSING COMPLETE === Found ${entries.length} entries`)
        
        // Memory optimization: Limit entries to prevent memory issues
        const maxEntries = 10000
        if (entries.length > maxEntries) {
          addLog(`Warning: Limiting entries to ${maxEntries} to prevent memory issues`)
          entries.splice(maxEntries)
        }
        
        saveData(entries)
        
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('keys-updated', entries)
        }
      } catch (error) {
        handleFileError('parsing', error)
      }
    }, PARSE_DEBOUNCE_MS)
  })
  
  fileWatcher.on('error', (error) => {
    handleFileError('file watching', error)
  })
}

// Enhanced Google Sheets export with cleanup
async function sendToGoogleSheets(entries) {
  try {
    addLog('Starting Google Sheets export...')
    
    const { google } = require('googleapis')
    const auth = new google.auth.GoogleAuth({
      keyFile: 'service-account.json',
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    })
    
    const sheets = google.sheets({ version: 'v4', auth })
    const spreadsheetId = store.get('googleSheetsId')
    
    if (!spreadsheetId) {
      throw new Error('Google Sheets ID not configured. Please set it in settings.')
    }
    
    // Clean up old entries first
    await cleanupOldKeysFromSheets()
    
    // Prepare data for export
    const values = [
      ['Character Name', 'Key Level', 'Dungeon', 'Source', 'Timestamp']
    ]
    
    entries.forEach(entry => {
      values.push([
        entry.character_name,
        entry.key_level.toString(),
        entry.dungeon_name,
        entry.source || 'friends',
        new Date(entry.parsed_timestamp).toISOString()
      ])
    })
    
    // Clear existing data and write new data
    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: 'A:E'
    })
    
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'A1',
      valueInputOption: 'RAW',
      resource: { values }
    })
    
    addLog(`Successfully exported ${entries.length} entries to Google Sheets`)
    
    // Send success message to renderer
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('export-success', {
        message: `Successfully exported ${entries.length} entries to Google Sheets`
      })
    }
    
  } catch (error) {
    const errorMessage = `Google Sheets export failed: ${error.message}`
    addLog(errorMessage, 'error')
    
    // Send error to renderer
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('export-error', {
        message: errorMessage
      })
    }
    
    throw error
  }
}

// Enhanced quit handling with better user experience
function handleQuit() {
  app.isQuiting = true
  
  // Save any pending data
  try {
    if (fileWatcher) {
      fileWatcher.close()
    }
  } catch (error) {
    console.error('Error closing file watcher:', error)
  }
  
  // Clean up resources
  try {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.destroy()
    }
  } catch (error) {
    console.error('Error destroying main window:', error)
  }
  
  app.quit()
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    show: false
  })

  mainWindow.loadFile('index.html')

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  mainWindow.on('minimize', (event) => {
    event.preventDefault()
    mainWindow.hide()
  })

  // Prevent accidental closure
  mainWindow.on('close', (event) => {
    if (!app.isQuiting) {
      event.preventDefault()
      mainWindow.hide()
    }
  })
}

function createSettingsWindow() {
  if (settingsWindow) {
    settingsWindow.focus()
    return
  }
  
  settingsWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    icon: path.join(__dirname, 'icon.png'),
    title: 'Astral Keys Monitor - Settings & Logs',
    resizable: true,
    minimizable: true,
    maximizable: true
  })
  
  settingsWindow.loadFile('settings.html')
  
  settingsWindow.on('closed', () => {
    settingsWindow = null
  })
}

function createTray() {
  const icon = nativeImage.createFromPath(path.join(__dirname, 'icon.png')).resize({ width: 16, height: 16 })
  
  tray = new Tray(icon)
  tray.setToolTip('Astral Keys Monitor')
  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show App',
      click: () => {
        if (mainWindow) {
          mainWindow.show()
        }
      }
    },
    {
      label: 'Settings & Logs',
      click: () => {
        createSettingsWindow()
      }
    },
    {
      label: 'Select AstralKeys.lua File',
      click: () => {
        selectFile()
      }
    },
    { type: 'separator' },
    {
      label: isAutoStartEnabled() ? 'Disable Auto-Start' : 'Enable Auto-Start',
      click: () => {
        const newState = !isAutoStartEnabled()
        store.set('autoStart', newState)
        setAutoStart(newState)
        createTray() // Recreate tray to update menu
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('show-quit-confirmation')
        } else {
          handleQuit()
        }
      }
    }
  ])
  
  tray.setContextMenu(contextMenu)
  
  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show()
    }
  })
}

// Common WoW installation paths to scan
function getCommonWowPaths() {
  const paths = []
  
  // Common retail installation paths
  const retailPaths = [
    'C:\\Program Files (x86)\\World of Warcraft\\_retail_\\WTF\\Account',
    'C:\\Program Files\\World of Warcraft\\_retail_\\WTF\\Account',
    'D:\\Program Files (x86)\\World of Warcraft\\_retail_\\WTF\\Account',
    'D:\\Program Files\\World of Warcraft\\_retail_\\WTF\\Account',
    'E:\\Program Files (x86)\\World of Warcraft\\_retail_\\WTF\\Account',
    'E:\\Program Files\\World of Warcraft\\_retail_\\WTF\\Account'
  ]
  
  // Common classic installation paths
  const classicPaths = [
    'C:\\Program Files (x86)\\World of Warcraft\\_classic_\\WTF\\Account',
    'C:\\Program Files\\World of Warcraft\\_classic_\\WTF\\Account',
    'D:\\Program Files (x86)\\World of Warcraft\\_classic_\\WTF\\Account',
    'D:\\Program Files\\World of Warcraft\\_classic_\\WTF\\Account'
  ]
  
  // Add all paths
  paths.push(...retailPaths, ...classicPaths)
  
  return paths
}

// Scan for AstralKeys.lua files
function scanForAstralKeysFile() {
  const foundFiles = []
  const wowPaths = getCommonWowPaths()
  
  addLog('Scanning for AstralKeys.lua files...')
  
  for (const wowPath of wowPaths) {
    if (fs.existsSync(wowPath)) {
      try {
        const accountFolders = fs.readdirSync(wowPath)
        
        for (const accountFolder of accountFolders) {
          const accountPath = path.join(wowPath, accountFolder)
          
          if (fs.statSync(accountPath).isDirectory()) {
            const savedVariablesPath = path.join(accountPath, 'SavedVariables')
            
            if (fs.existsSync(savedVariablesPath)) {
              const astralKeysPath = path.join(savedVariablesPath, 'AstralKeys.lua')
              
              if (fs.existsSync(astralKeysPath)) {
                foundFiles.push({
                  path: astralKeysPath,
                  account: accountFolder,
                  type: wowPath.includes('_retail_') ? 'Retail' : 'Classic'
                })
                addLog(`Found AstralKeys.lua: ${astralKeysPath} (${accountFolder} - ${wowPath.includes('_retail_') ? 'Retail' : 'Classic'})`)
              }
            }
          }
        }
      } catch (error) {
        addLog(`Error scanning ${wowPath}: ${error.message}`, 'error')
      }
    }
  }
  
  return foundFiles
}

function selectFile() {
  // First, try to auto-detect the file
  const foundFiles = scanForAstralKeysFile()
  
  if (foundFiles.length === 1) {
    // Only one file found, use it automatically
    const filePath = foundFiles[0].path
    addLog(`Auto-detected AstralKeys.lua: ${filePath}`)
    store.set('astralKeysPath', filePath)
    startFileWatching(filePath)
    
    if (mainWindow) {
      mainWindow.webContents.send('file-selected', filePath)
    }
    
    // Show success message
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'AstralKeys.lua Found',
      message: `Auto-detected AstralKeys.lua file:\n\n${filePath}\n\nAccount: ${foundFiles[0].account}\nType: ${foundFiles[0].type}`,
      buttons: ['OK']
    })
    
    return
  } else if (foundFiles.length > 1) {
    // Multiple files found, let user choose
    const fileOptions = foundFiles.map(file => ({
      label: `${file.account} (${file.type})`,
      value: file.path
    }))
    
    dialog.showMessageBox(mainWindow, {
      type: 'question',
      title: 'Multiple AstralKeys.lua Files Found',
      message: 'Multiple AstralKeys.lua files were found. Please select which one to use:',
      buttons: ['Cancel', ...fileOptions.map(option => option.label)]
    }).then((result) => {
      if (result.response > 0) {
        const selectedFile = foundFiles[result.response - 1]
        const filePath = selectedFile.path
        
        addLog(`Selected AstralKeys.lua: ${filePath}`)
        store.set('astralKeysPath', filePath)
        startFileWatching(filePath)
        
        if (mainWindow) {
          mainWindow.webContents.send('file-selected', filePath)
        }
      }
    }).catch(err => {
      console.error('Error selecting from multiple files:', err)
      // Fall back to manual selection
      showFileDialog()
    })
    
    return
  }
  
  // No files found or user cancelled, show manual file dialog
  showFileDialog()
}

function showFileDialog() {
  dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'Lua Files', extensions: ['lua'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  }).then(result => {
    if (!result.canceled && result.filePaths.length > 0) {
      const filePath = result.filePaths[0]
      store.set('astralKeysPath', filePath)
      startFileWatching(filePath)
      
      if (mainWindow) {
        mainWindow.webContents.send('file-selected', filePath)
      }
    }
  }).catch(err => {
    console.error('Error selecting file:', err)
  })
}

// IPC handlers
ipcMain.handle('select-file', () => {
  selectFile()
})

ipcMain.handle('scan-for-files', () => {
  selectFile()
})

ipcMain.handle('test-parse', () => {
  const storedPath = store.get('astralKeysPath')
  if (storedPath && fs.existsSync(storedPath)) {
    console.log('=== MANUAL TEST PARSE ===')
    const entries = parseAstralKeysLua(storedPath)
    console.log('=== MANUAL TEST COMPLETE ===')
    return entries
  }
  return []
})

ipcMain.handle('get-stored-path', () => {
  return store.get('astralKeysPath')
})

ipcMain.handle('get-keys-data', () => {
  const dataPath = path.join(app.getPath('userData'), 'astral_keys_data.json')
  if (fs.existsSync(dataPath)) {
    const data = fs.readFileSync(dataPath, 'utf8')
    return JSON.parse(data)
  }
  return null
})

ipcMain.handle('refresh-data', () => {
  const storedPath = store.get('astralKeysPath')
  if (storedPath && fs.existsSync(storedPath)) {
    console.log('=== REFRESH PARSE ===')
    const entries = parseAstralKeysLua(storedPath)
    console.log('=== REFRESH COMPLETE ===')
    saveData(entries)
    return entries
  }
  return []
})

ipcMain.handle('get-auto-start-status', () => {
  return isAutoStartEnabled()
})

ipcMain.handle('set-auto-start', (event, enable) => {
  store.set('autoStart', enable)
  setAutoStart(enable)
  return true
})

ipcMain.handle('get-start-hidden', () => {
  return store.get('startHidden', false)
})

ipcMain.handle('set-start-hidden', (event, hidden) => {
  store.set('startHidden', hidden)
  return true
})

ipcMain.handle('export-to-sheets', async () => {
  try {
    const dataPath = path.join(app.getPath('userData'), 'astral_keys_data.json')
    if (fs.existsSync(dataPath)) {
      const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'))
      addLog(`Attempting to export ${data.entries.length} keys to Google Sheets...`)
      await sendToGoogleSheets(data.entries)
      addLog('Google Sheets export completed successfully')
      return true
    } else {
      throw new Error('No keys data found. Please parse a file first.')
    }
  } catch (error) {
    addLog(`Error in export-to-sheets: ${error.message}`, 'error')
    throw error
  }
})

ipcMain.handle('cleanup-sheets', () => {
  return cleanupOldKeysFromSheets()
})

ipcMain.handle('quit-app', () => {
  handleQuit()
})

// Logging system IPC handlers
ipcMain.handle('get-logs', () => {
  return logs
})

ipcMain.handle('clear-logs', () => {
  logs = []
  addLog('Logs cleared by user')
  return true
})

ipcMain.handle('get-log-settings', () => {
  return {
    maxLogs,
    currentLogCount: logs.length
  }
})

app.whenReady().then(() => {
  // Update existing auto-start files to ensure they use --hidden
  updateAutoStartFiles()
  
  createWindow()
  createTray()
  
  // Start watching if we have a stored path
  const storedPath = store.get('astralKeysPath')
  if (storedPath && fs.existsSync(storedPath)) {
    startFileWatching(storedPath)
  }
  
  // Check if we should start hidden (auto-start mode)
  const shouldStartHidden = process.argv.includes('--hidden') || store.get('startHidden', false)
  if (shouldStartHidden && mainWindow) {
    mainWindow.hide()
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.on('before-quit', () => {
  if (fileWatcher) {
    fileWatcher.close()
  }
}) 