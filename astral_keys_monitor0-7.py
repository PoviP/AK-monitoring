import os
import time
import re
import datetime
import tkinter as tk
from tkinter import filedialog, messagebox, scrolledtext
import threading
import sys
import socket
from googleapiclient.discovery import build
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from google.oauth2 import service_account
import json
import argparse
import slpp
import requests

# Global variables
SCOPES = ['https://www.googleapis.com/auth/spreadsheets']
SPREADSHEET_ID = '1TkcGBmRctSwMJTHXgfl9WZEgj-7l6IWFIYD7ipqC4Y4'  # Replace with your actual spreadsheet ID
SOURCE_ID = socket.gethostname()
monitoring_active = False
monitor_thread = None
DUNGEON_NAMES = {} 

DUNGEONS_LUA_URL = "https://raw.githubusercontent.com/astralguild/AstralKeys/refs/heads/main/Dungeons.lua"

parser = argparse.ArgumentParser(description='AstralKeys Monitor')
parser.add_argument('--autostart', action='store_true', help='Start monitoring automatically on launch')
args = parser.parse_args()

def fetch_dungeon_names():
    """Fetch dungeon names from GitHub"""
    global DUNGEON_NAMES
    
    try:
        print("Fetching dungeon names from GitHub...")
        response = requests.get(DUNGEONS_LUA_URL)
        
        if response.status_code == 200:
            lua_content = response.text
            
            # Extract the dungeon table data
            table_entries = []
            
            # Process each line that contains a dungeon mapping
            for line in lua_content.splitlines():
                # Match lines like: DUNGEON_TABLE[123] = L["Dungeon Name"]
                match = re.search(r'DUNGEON_TABLE\[(\d+)\]\s*=\s*L\["([^"]+)"\]', line)
                if match:
                    dungeon_id = int(match.group(1))
                    dungeon_name = match.group(2)
                    DUNGEON_NAMES[dungeon_id] = dungeon_name
            
            print(f"Loaded {len(DUNGEON_NAMES)} dungeon names from GitHub")
            
            # If GitHub fetch fails or returns empty, use fallback values
            if not DUNGEON_NAMES:
                set_fallback_dungeon_names()
                
        else:
            print(f"Failed to fetch dungeons: HTTP {response.status_code}")
            set_fallback_dungeon_names()
            
    except Exception as e:
        print(f"Error fetching dungeon names: {e}")
        set_fallback_dungeon_names()

def set_fallback_dungeon_names():
    """Set fallback dungeon names if GitHub fetch fails"""
    global DUNGEON_NAMES
    
    print("Using fallback dungeon names")
    # Fallback names - these will be used if GitHub fetch fails
    DUNGEON_NAMES = {
        370: "Mechagon Workshop",
        382: "Theater of Pain",
        499: "Priory of the Sacred Flame",
        500: "The Rookery",
        504: "Darkflame Cleft",
        506: "Cinderbrew Meadery",
        525: "Operation: Floodgate",
        247: "The MOTHERLODE!!",
    }

def resource_path(relative_path):
    """Get absolute path to resource, works for dev and for PyInstaller"""
    try:
        if getattr(sys, 'frozen', False):
            base_path = sys._MEIPASS
        else:
            base_path = os.path.abspath(".")
        return os.path.join(base_path, relative_path)
    except Exception as e:
        print(f"Error in resource_path: {e}")
        return relative_path

def extract_entries_from_lua(file_path):
    """Extract entries from the AstralKeys.lua file using SLPP parser"""
    print(f"Processing file: {file_path}")
    
    try:
        with open(file_path, 'r', encoding='utf-8') as file:
            content = file.read()
        
        print(f"File size: {len(content)} bytes")
        
        # Find the start of the AstralKeys table
        start_index = content.find("AstralKeys = ")
        if start_index == -1:
            print("AstralKeys table not found in file")
            return [], {}
        
        # Extract just the Lua table part
        lua_content = content[start_index + len("AstralKeys = "):]
        end_index = lua_content.find("AstralCharacters = ")
        if end_index != -1:
            lua_content = lua_content[:end_index].strip()
        
        # Add proper table enclosure if needed
        if not lua_content.startswith("{"):
            lua_content = "{" + lua_content
        if not lua_content.endswith("}"):
            lua_content = lua_content + "}"
            
        # Parse the Lua table using slpp
        parser = slpp.SLPP()
        parsed_data = parser.decode(lua_content)
        
        # Process the parsed data
        entries = []
        timestamps = {}
        
        for entry in parsed_data:
            if "unit" in entry and "key_level" in entry and "dungeon_id" in entry:
                unit = entry["unit"]
                key_level = str(entry["key_level"])
                dungeon_id = str(entry["dungeon_id"])
                
                entries.append([unit, key_level, dungeon_id])
                
                if "time_stamp" in entry:
                    timestamps[unit] = str(entry["time_stamp"])
                else:
                    timestamps[unit] = "0"
        
        print(f"Extracted {len(entries)} entries total")
        return entries, timestamps
        
    except Exception as e:
        print(f"Error extracting entries: {e}")
        import traceback
        traceback.print_exc()
        return [], {}

def get_credentials():
    """Get Google API credentials using service account"""
    try:
        # Path to service account key file
        service_account_file = resource_path('service-account.json')
        
        print(f"Looking for service account file at: {service_account_file}")
        
        if not os.path.exists(service_account_file):
            print("Service account file not found!")
            messagebox.showerror("Error", "service-account.json not found! Please make sure it's in the same folder as the executable.")
            return None
        
        # Create credentials from service account file
        creds = service_account.Credentials.from_service_account_file(
            service_account_file, scopes=SCOPES)
        
        print("Service account credentials loaded successfully")
        return creds
    except Exception as e:
        print(f"Error loading service account credentials: {e}")
        import traceback
        traceback.print_exc()
        return None

def load_current_sheet_data():
    """Load data from the Google Sheet"""
    try:
        creds = get_credentials()
        if not creds:
            return {}
            
        service = build('sheets', 'v4', credentials=creds)
        
        result = service.spreadsheets().values().get(
            spreadsheetId=SPREADSHEET_ID,
            range='Sheet1!A2:F'
        ).execute()
        
        values = result.get('values', [])
        current_data = {}
        
        for row in values:
            if len(row) >= 3:
                unit = row[0]
                key_level = row[1]
                dungeon_id = row[2]
                last_updated = row[3] if len(row) > 3 else ""
                source = row[4] if len(row) > 4 else ""
                wow_timestamp = row[5] if len(row) > 5 else "0"
                
                current_data[unit] = {
                    'key_level': key_level,
                    'dungeon_id': dungeon_id,
                    'last_updated': last_updated,
                    'source': source,
                    'wow_timestamp': wow_timestamp
                }
        
        return current_data
    except Exception as e:
        print(f"Error loading sheet data: {e}")
        import traceback
        traceback.print_exc()
        return {}

def merge_with_sheet_data(new_entries, timestamps):
    """Merge new entries with existing sheet data"""
    current_sheet_data = load_current_sheet_data()
    current_time = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    merged_data = []
    updated_units = set()
    
    for entry in new_entries:
        unit, key_level, dungeon_id = entry
        updated_units.add(unit)
        wow_timestamp = timestamps.get(unit, "0")
        
        # Convert dungeon ID to name
        dungeon_name = DUNGEON_NAMES.get(int(dungeon_id), f"Unknown ({dungeon_id})")
        
        if unit in current_sheet_data:
            sheet_entry = current_sheet_data[unit]
            
            if int(wow_timestamp) > int(sheet_entry.get('wow_timestamp', "0")):
                merged_data.append([
                    unit, key_level, dungeon_name, current_time, SOURCE_ID, wow_timestamp
                ])
                print(f"Updating: {unit} with level {key_level} {dungeon_name}")
            else:
                merged_data.append([
                    unit,
                    sheet_entry['key_level'],
                    sheet_entry['dungeon_id'],
                    sheet_entry['last_updated'],
                    sheet_entry['source'], 
                    sheet_entry['wow_timestamp']
                ])
                print(f"Keeping existing: {unit}")
        else:
            merged_data.append([
                unit, key_level, dungeon_name, current_time, SOURCE_ID, wow_timestamp
            ])
            print(f"Adding new: {unit} with level {key_level} {dungeon_name}")
    
    for unit, data in current_sheet_data.items():
        if unit not in updated_units:
            merged_data.append([
                unit,
                data['key_level'],
                data['dungeon_id'],
                data['last_updated'],
                data['source'],
                data.get('wow_timestamp', "0")
            ])
    
    return merged_data

def update_sheets(data):
    """Update Google Sheets with the merged data"""
    if not data:
        return
        
    try:
        creds = get_credentials()
        if not creds:
            return
            
        service = build('sheets', 'v4', credentials=creds)
        
        # Clear the existing data
        service.spreadsheets().values().clear(
            spreadsheetId=SPREADSHEET_ID,
            range='Sheet1!A2:F'
        ).execute()
        
        # Update with new data
        service.spreadsheets().values().update(
            spreadsheetId=SPREADSHEET_ID,
            range='Sheet1!A2',
            valueInputOption='RAW',
            body={'values': data}
        ).execute()
        
        print(f"Updated {len(data)} rows in Google Sheets")
        
    except Exception as e:
        print(f"Error updating Google Sheets: {e}")
        import traceback
        traceback.print_exc()

def monitor_file(file_path):
    """Monitor file for changes"""
    global monitoring_active
    
    print(f"Monitoring file: {file_path}")
    last_modified = os.path.getmtime(file_path)
    
    while monitoring_active:
        try:
            if os.path.exists(file_path):
                current_modified = os.path.getmtime(file_path)
                if current_modified > last_modified:
                    print(f"Change detected at {time.strftime('%H:%M:%S')}")
                    last_modified = current_modified
                    entries, timestamps = extract_entries_from_lua(file_path)
                    if entries:
                        merged_data = merge_with_sheet_data(entries, timestamps)
                        update_sheets(merged_data)
            else:
                print(f"Warning: File {file_path} no longer exists!")
                time.sleep(30)  # Wait longer if file is missing
        except Exception as e:
            print(f"Error monitoring file: {e}")
        
        time.sleep(5)

def create_gui():
    """Create the GUI"""
    global monitoring_active, monitor_thread, SPREADSHEET_ID
    
    # Create config path
    config_path = os.path.join(os.path.expanduser("~"), "astralkeys_config.json")
    
    # Create main window - moved BEFORE creating variables
    root = tk.Tk()
    root.title("AstralKeys Monitor")
    root.geometry("700x500")
    
    # Variables - moved AFTER creating root window
    file_path_var = tk.StringVar()
    status_var = tk.StringVar(value="Not Monitoring")
    
    # Function to load settings
    def load_settings():
        try:
            if os.path.exists(config_path):
                with open(config_path, 'r') as f:
                    config = json.load(f)
                    file_path_var.set(config.get('file_path', ''))
                    return True
            return False
        except:
            return False
    
    # Function to save settings
    def save_settings():
        try:
            config = {
                'file_path': file_path_var.get()
            }
            with open(config_path, 'w') as f:
                json.dump(config, f)
        except:
            pass
    
    # Create frames
    top_frame = tk.Frame(root)
    top_frame.pack(fill=tk.X, padx=10, pady=10)
    
    button_frame = tk.Frame(root)
    button_frame.pack(fill=tk.X, padx=10, pady=10)
    
    log_frame = tk.Frame(root)
    log_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
    
    status_frame = tk.Frame(root)
    status_frame.pack(fill=tk.X, padx=10, pady=5)
    
    # File path selection
    tk.Label(top_frame, text="AstralKeys.lua Path:").pack(side=tk.LEFT, padx=(0, 5))
    tk.Entry(top_frame, textvariable=file_path_var, width=50).pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0, 5))
    
    def browse_file():
        file_path = filedialog.askopenfilename(
            title="Select AstralKeys.lua File",
            filetypes=[("Lua Files", "*.lua"), ("All Files", "*.*")]
        )
        if file_path:
            file_path_var.set(file_path)
    
    tk.Button(top_frame, text="Browse...", command=browse_file).pack(side=tk.RIGHT)
    
    # Log area
    log_area = scrolledtext.ScrolledText(log_frame, wrap=tk.WORD, height=15)
    log_area.pack(fill=tk.BOTH, expand=True)
    log_area.config(state=tk.DISABLED)
    
    # Status bar
    tk.Label(status_frame, text="Status:").pack(side=tk.LEFT, padx=(0, 5))
    tk.Label(status_frame, textvariable=status_var, foreground="blue").pack(side=tk.LEFT)
    
    # Redirect stdout to log area
    class StdoutRedirector:
        def __init__(self, text_widget):
            self.text_widget = text_widget
            
        def write(self, string):
            try:
                self.text_widget.config(state=tk.NORMAL)
                self.text_widget.insert(tk.END, string)
                self.text_widget.see(tk.END)
                self.text_widget.config(state=tk.DISABLED)
            except:
                pass
            
        def flush(self):
            pass
    
    sys.stdout = StdoutRedirector(log_area)
    
    # Function to refresh dungeon names from GitHub
    def refresh_dungeons():
        try:
            fetch_dungeon_names()
            messagebox.showinfo("Success", f"Successfully loaded {len(DUNGEON_NAMES)} dungeon names from GitHub.")
        except Exception as e:
            print(f"Error refreshing dungeon names: {e}")
            messagebox.showerror("Error", f"Failed to refresh dungeon names: {str(e)}")
    
    # Start/Stop monitoring
    def toggle_monitoring():
        global monitoring_active, monitor_thread
        
        if not monitoring_active:
            file_path = file_path_var.get().strip()
            
            if not file_path:
                messagebox.showerror("Error", "Please select the AstralKeys.lua file first.")
                return
                
            if not os.path.isfile(file_path):
                messagebox.showerror("Error", f"File not found: {file_path}")
                return
                
            # Save settings
            save_settings()
            
            # Start monitoring
            monitoring_active = True
            start_button.config(text="Stop Monitoring", bg="red")
            status_var.set("Monitoring Active")
            
            # Process file immediately
            try:
                entries, timestamps = extract_entries_from_lua(file_path)
                if entries:
                    merged_data = merge_with_sheet_data(entries, timestamps)
                    update_sheets(merged_data)
            except Exception as e:
                print(f"Error in initial processing: {e}")
                import traceback
                traceback.print_exc()
            
            # Start monitoring thread
            monitor_thread = threading.Thread(
                target=monitor_file,
                args=(file_path,),
                daemon=True
            )
            monitor_thread.start()
        else:
            # Stop monitoring
            monitoring_active = False
            start_button.config(text="Start Monitoring", bg="green")
            status_var.set("Not Monitoring")
    
    # Create "Add to Startup" function
    def add_to_startup():
        try:
            file_path = file_path_var.get().strip()
            
            if not file_path:
                messagebox.showerror("Error", "Please select the AstralKeys.lua file first.")
                return
                
            # Save settings first
            save_settings()
            
            # Create a simple batch file that runs the executable
            startup_folder = os.path.join(os.environ["APPDATA"], "Microsoft", "Windows", "Start Menu", "Programs", "Startup")
            bat_path = os.path.join(startup_folder, "AstralKeysMonitor.bat")
            
            exe_path = sys.executable
            
            with open(bat_path, "w") as f:
                f.write("@echo off\n")
                f.write(f'cd /d "{os.path.dirname(exe_path)}"\n')
                f.write(f'start "" "{exe_path}" --autostart\n')
            
            messagebox.showinfo("Success", f"Added to Windows startup. The application will now start automatically when you log in.")
        except Exception as e:
            print(f"Error adding to startup: {e}")
            messagebox.showerror("Error", f"Could not add to startup: {str(e)}")
    
    # Buttons
    start_button = tk.Button(button_frame, text="Start Monitoring", bg="green", fg="white", command=toggle_monitoring)
    start_button.pack(side=tk.LEFT, padx=5)
    
    tk.Button(button_frame, text="Add to Startup", command=add_to_startup).pack(side=tk.LEFT, padx=5)
    
    # Add a Refresh Dungeons button
    refresh_button = tk.Button(button_frame, text="Refresh Dungeons", command=refresh_dungeons)
    refresh_button.pack(side=tk.LEFT, padx=5)
    
    # Load saved settings
    settings_loaded = load_settings()
    
    # Fetch dungeon names at startup
    fetch_dungeon_names()
    
    # Check if we should autostart monitoring
    if args.autostart:
        print("Autostart argument detected")
        settings_loaded = load_settings()
        if settings_loaded:
            file_path = file_path_var.get().strip()
            if file_path and os.path.isfile(file_path):
                print(f"Auto-starting monitoring for {file_path}")
                # Use a timer to start monitoring after the GUI is fully loaded
                root.after(1000, toggle_monitoring)
    
    # Start GUI event loop
    root.mainloop()

if __name__ == "__main__":
    try:
        # Create a debug log file at startup
        debug_log_path = os.path.join(os.path.dirname(os.path.abspath(sys.argv[0])), "debug.log")
        with open(debug_log_path, "w") as f:
            f.write(f"Application started at {datetime.datetime.now()}\n")
            f.write(f"Python executable: {sys.executable}\n")
            f.write(f"Arguments: {sys.argv}\n")
            f.write(f"Working directory: {os.getcwd()}\n")
            
            if getattr(sys, 'frozen', False):
                f.write("Running as frozen application\n")
            else:
                f.write("Running as script\n")
                
        create_gui()
    except Exception as e:
        # Log critical errors
        with open(os.path.join(os.path.dirname(os.path.abspath(sys.argv[0])), "error.log"), "w") as f:
            f.write(f"Critical error at {datetime.datetime.now()}: {str(e)}\n")
            import traceback
            f.write(traceback.format_exc())
        
        try:
            messagebox.showerror("Error", f"A critical error occurred: {str(e)}")
        except:
            pass