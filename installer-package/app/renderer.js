const { ipcRenderer } = require('electron')

let keys = []
let isMonitoring = false
let selectedFilePath = ''
let currentTheme = 'light'

// DOM elements
const selectFileBtn = document.getElementById('selectFile')
const scanForFilesBtn = document.getElementById('scanForFiles')
const refreshBtn = document.getElementById('refresh')
const testParseBtn = document.getElementById('testParse')
const statusText = document.getElementById('statusText')
const filePath = document.getElementById('filePath')
const lastUpdated = document.getElementById('lastUpdated')
const totalKeys = document.getElementById('totalKeys')
const friendsKeys = document.getElementById('friendsKeys')
const guildKeys = document.getElementById('guildKeys')
const keysList = document.getElementById('keysList')
const autoStartCheckbox = document.getElementById('autoStart')
const startHiddenCheckbox = document.getElementById('startHidden')
const exportToSheetsBtn = document.getElementById('exportToSheets')
const toggleThemeBtn = document.getElementById('toggleTheme')
const dungeonChart = document.getElementById('dungeonChart')

// Dropdown functionality
const dropdownToggle = document.querySelector('.dropdown-toggle')
const dropdownMenu = document.querySelector('.dropdown-menu')

// Toast system
function showToast(title, message, type = 'info', duration = 5000) {
    const toastContainer = document.getElementById('toastContainer')
    const toast = document.createElement('div')
    toast.className = `toast ${type}`
    
    toast.innerHTML = `
        <div class="toast-header">
            <span class="toast-title">${title}</span>
            <button class="toast-close" onclick="this.parentElement.parentElement.remove()">×</button>
        </div>
        <div class="toast-message">${message}</div>
    `
    
    toastContainer.appendChild(toast)
    
    // Auto-remove after duration
    setTimeout(() => {
        if (toast.parentElement) {
            toast.classList.add('fade-out')
            setTimeout(() => {
                if (toast.parentElement) {
                    toast.remove()
                }
            }, 300)
        }
    }, duration)
}

// Theme management
function toggleTheme() {
    currentTheme = currentTheme === 'light' ? 'dark' : 'light'
    document.documentElement.setAttribute('data-theme', currentTheme)
    toggleThemeBtn.textContent = currentTheme === 'light' ? '🌙' : '☀️'
    localStorage.setItem('theme', currentTheme)
}

function loadTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light'
    currentTheme = savedTheme
    document.documentElement.setAttribute('data-theme', currentTheme)
    toggleThemeBtn.textContent = currentTheme === 'light' ? '🌙' : '☀️'
}

// Event listeners
selectFileBtn.addEventListener('click', async () => {
    try {
        await ipcRenderer.invoke('select-file')
    } catch (error) {
        console.error('Error selecting file:', error)
        showToast('Error', 'Failed to select file. Please try again.', 'error')
    }
})

scanForFilesBtn.addEventListener('click', async () => {
    try {
        showToast('Scanning', 'Searching for AstralKeys.lua files...', 'info', 2000)
        await ipcRenderer.invoke('scan-for-files')
    } catch (error) {
        console.error('Error scanning for files:', error)
        showToast('Error', 'Failed to scan for files. Please try again.', 'error')
    }
})

refreshBtn.addEventListener('click', async () => {
    try {
        showToast('Refreshing', 'Updating key data...', 'info', 2000)
        const entries = await ipcRenderer.invoke('refresh-data')
        console.log('Refresh result:', entries)
        
        keys = entries
        updateUI()
        showToast('Success', `Refreshed ${entries.length} keys`, 'success')
    } catch (error) {
        console.error('Error refreshing data:', error)
        showToast('Error', 'Failed to refresh data. Please check your file.', 'error')
    }
})

testParseBtn.addEventListener('click', async () => {
    try {
        showToast('Testing', 'Parsing current file...', 'info', 2000)
        const entries = await ipcRenderer.invoke('test-parse')
        console.log('Test parse result:', entries)
        
        keys = entries
        updateUI()
        showToast('Success', `Found ${entries.length} keys in test parse`, 'success')
    } catch (error) {
        console.error('Error in test parse:', error)
        showToast('Error', 'Failed to parse file. Please check the file format.', 'error')
    }
})

// Settings event listeners
autoStartCheckbox.addEventListener('change', async (event) => {
    try {
        await ipcRenderer.invoke('set-auto-start', event.target.checked)
        showToast('Settings', `Auto-start ${event.target.checked ? 'enabled' : 'disabled'}`, 'success')
    } catch (error) {
        console.error('Error setting auto-start:', error)
        showToast('Error', 'Failed to update auto-start setting', 'error')
    }
})

startHiddenCheckbox.addEventListener('change', async (event) => {
    try {
        await ipcRenderer.invoke('set-start-hidden', event.target.checked)
        showToast('Settings', `Start hidden ${event.target.checked ? 'enabled' : 'disabled'}`, 'success')
    } catch (error) {
        console.error('Error setting start hidden:', error)
        showToast('Error', 'Failed to update start hidden setting', 'error')
    }
})

exportToSheetsBtn.addEventListener('click', async () => {
    try {
        showToast('Exporting', 'Sending data to Google Sheets...', 'info', 3000)
        await ipcRenderer.invoke('export-to-sheets')
        showToast('Success', 'Successfully exported to Google Sheets!', 'success')
    } catch (error) {
        console.error('Error exporting to Google Sheets:', error)
        showToast('Error', `Export failed: ${error.message}`, 'error')
    }
})

toggleThemeBtn.addEventListener('click', toggleTheme)

// Dropdown toggle
dropdownToggle.addEventListener('click', (e) => {
    e.stopPropagation()
    dropdownMenu.classList.toggle('show')
})

// Close dropdown when clicking outside
document.addEventListener('click', () => {
    dropdownMenu.classList.remove('show')
})

// Prevent dropdown from closing when clicking inside
dropdownMenu.addEventListener('click', (e) => {
    e.stopPropagation()
})

// Load initial data
async function loadKeysData() {
    try {
        const data = await ipcRenderer.invoke('get-keys-data')
        if (data) {
            keys = data.entries || []
            updateUI()
        }
    } catch (error) {
        console.error('Error loading keys data:', error)
        showToast('Error', 'Failed to load saved data', 'error')
    }
}

// Check stored path
async function checkStoredPath() {
    try {
        const path = await ipcRenderer.invoke('get-stored-path')
        if (path) {
            selectedFilePath = path
            isMonitoring = true
            updateUI()
        }
    } catch (error) {
        console.error('Error checking stored path:', error)
    }
}

// Calculate dungeon popularity
function calculateDungeonPopularity(keys) {
    const dungeonCounts = {}
    const totalKeys = keys.length
    
    keys.forEach(key => {
        const dungeonName = key.dungeon_name
        dungeonCounts[dungeonName] = (dungeonCounts[dungeonName] || 0) + 1
    })
    
    return Object.entries(dungeonCounts)
        .map(([name, count]) => ({
            name,
            count,
            percentage: totalKeys > 0 ? Math.round((count / totalKeys) * 100) : 0
        }))
        .sort((a, b) => b.count - a.count)
}

// Update dungeon chart
function updateDungeonChart(keys) {
    if (keys.length === 0) {
        dungeonChart.innerHTML = '<div class="empty-state">No dungeon data available</div>'
        return
    }
    
    const dungeonStats = calculateDungeonPopularity(keys)
    
    dungeonChart.innerHTML = dungeonStats.map(dungeon => `
        <div class="dungeon-item">
            <h4>${dungeon.name}</h4>
            <div class="count">${dungeon.count}</div>
            <div class="percentage">${dungeon.percentage}%</div>
        </div>
    `).join('')
}

// Update UI
function updateUI() {
    // Update status
    if (isMonitoring) {
        statusText.textContent = 'Monitoring Active'
        statusText.className = 'monitoring'
    } else {
        statusText.textContent = 'Not Monitoring'
        statusText.className = ''
    }

    // Update file path
    if (selectedFilePath) {
        const fileName = selectedFilePath.split('\\').pop()
        filePath.textContent = `File: ${fileName}`
    } else {
        filePath.textContent = ''
    }

    // Update stats
    const friendsCount = keys.filter(k => k.source === 'friends' || !k.source).length
    const guildCount = keys.filter(k => k.source === 'guild').length

    totalKeys.textContent = keys.length
    friendsKeys.textContent = friendsCount
    guildKeys.textContent = guildCount

    // Update dungeon chart
    updateDungeonChart(keys)

    // Update keys list
    if (keys.length === 0) {
        keysList.innerHTML = '<div class="empty-state">No keys found. Select a file to start monitoring.</div>'
    } else {
        keysList.innerHTML = keys.map(key => `
            <div class="key-item">
                <h3>${key.character_name} <span class="source-badge source-${key.source || 'friends'}">${key.source === 'guild' ? 'Guild' : 'Friends'}</span></h3>
                <p><strong>Level:</strong> ${key.key_level} | <strong>Dungeon:</strong> ${key.dungeon_name}</p>
                <p><strong>Updated:</strong> ${new Date(key.parsed_timestamp).toLocaleString()}</p>
            </div>
        `).join('')
    }
}

// Listen for file selection and key updates
ipcRenderer.on('file-selected', (event, filePath) => {
    selectedFilePath = filePath
    isMonitoring = true
    updateUI()
    showToast('File Selected', 'Monitoring started successfully', 'success')
})

ipcRenderer.on('keys-updated', (event, newKeys) => {
    keys = newKeys
    updateUI()
    showToast('Keys Updated', `Updated ${newKeys.length} keys`, 'success')
})

// Listen for quit confirmation
ipcRenderer.on('show-quit-confirmation', () => {
    if (confirm('Are you sure you want to quit Astral Keys Monitor?')) {
        ipcRenderer.invoke('quit-app')
    }
})

// Listen for export results
ipcRenderer.on('export-success', (event, data) => {
    showToast('Export Success', data.message, 'success')
})

ipcRenderer.on('export-error', (event, data) => {
    showToast('Export Error', data.message, 'error')
})

// Listen for general errors
ipcRenderer.on('show-error', (event, data) => {
    showToast(data.title, data.message, 'error')
})

// Load settings
async function loadSettings() {
    try {
        const autoStartStatus = await ipcRenderer.invoke('get-auto-start-status')
        autoStartCheckbox.checked = autoStartStatus
        
        const startHidden = await ipcRenderer.invoke('get-start-hidden')
        startHiddenCheckbox.checked = startHidden
    } catch (error) {
        console.error('Error loading settings:', error)
        showToast('Error', 'Failed to load settings', 'error')
    }
}

// Initialize
loadKeysData()
checkStoredPath()
loadSettings()
loadTheme() 