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
