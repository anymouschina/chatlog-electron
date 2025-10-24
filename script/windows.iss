; Inno Setup script for packaging Chatlog on Windows
; 1) Build binary first: make crossbuild (or produce chatlog.exe)
; 2) Copy/rename the appropriate binary to: dist\chatlog\chatlog.exe
; 3) Run Inno Setup with this script to create an installer

#define MyAppName "Chatlog"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "sjzar"
#define MyAppExeName "chatlog.exe"

[Setup]
AppId={{B7D78BA2-8B90-4F6E-9E10-8E0A5D3F2F1C}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
OutputBaseFilename=Chatlog_Setup
Compression=lzma
SolidCompression=yes
WizardStyle=modern

[Languages]
Name: "en"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Create a &desktop icon"; GroupDescription: "Additional icons:"; Flags: unchecked

[Files]
Source: "dist\chatlog\{#MyAppExeName}"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{commondesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon
; Optional: a shortcut to run HTTP/MCP server mode
Name: "{group}\{#MyAppName} Server"; Filename: "{app}\{#MyAppExeName}"; Parameters: "server"; WorkingDir: "{app}"
Name: "{commondesktop}\{#MyAppName} Server"; Filename: "{app}\{#MyAppExeName}"; Parameters: "server"; WorkingDir: "{app}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "Launch {#MyAppName}"; Flags: nowait postinstall skipifsilent
