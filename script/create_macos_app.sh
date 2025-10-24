#!/usr/bin/env bash
set -euo pipefail

APP_NAME="Chatlog"
APP_DIR="${APP_NAME}.app"
BIN_DIR="bin"
BIN_NAME="chatlog"
ASSETS_ICON="assets/icon.icns"

if [[ ! -x "${BIN_DIR}/${BIN_NAME}" ]]; then
  echo "Binary ${BIN_DIR}/${BIN_NAME} not found. Building..."
  make build
fi

echo "Creating ${APP_DIR} bundle..."
rm -rf "${APP_DIR}"
mkdir -p "${APP_DIR}/Contents/MacOS" "${APP_DIR}/Contents/Resources"

# Copy binary to Resources (keep MacOS/launcher as a thin wrapper)
cp "${BIN_DIR}/${BIN_NAME}" "${APP_DIR}/Contents/Resources/${BIN_NAME}"
chmod +x "${APP_DIR}/Contents/Resources/${BIN_NAME}"

# Create launcher that opens Terminal and runs chatlog
cat > "${APP_DIR}/Contents/MacOS/launcher" <<'EOS'
#!/usr/bin/env bash
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
BIN="$DIR/../Resources/chatlog"

# Open Terminal and run chatlog
osascript <<APPLESCRIPT
tell application "Terminal"
  activate
  do script quoted form of POSIX path of "$BIN"
end tell
APPLESCRIPT
EOS
chmod +x "${APP_DIR}/Contents/MacOS/launcher"

# Write Info.plist
ICON_KEY=""
if [[ -f "${ASSETS_ICON}" ]]; then
  cp "${ASSETS_ICON}" "${APP_DIR}/Contents/Resources/icon.icns"
  ICON_KEY="\n\t<key>CFBundleIconFile</key>\n\t<string>icon</string>"
fi

cat > "${APP_DIR}/Contents/Info.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple Computer//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleName</key>
    <string>${APP_NAME}</string>
    <key>CFBundleDisplayName</key>
    <string>${APP_NAME}</string>
    <key>CFBundleIdentifier</key>
    <string>com.github.sjzar.chatlog</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleExecutable</key>
    <string>launcher</string>
    <key>LSMinimumSystemVersion</key>
    <string>10.13</string>${ICON_KEY}
    <key>NSHighResolutionCapable</key>
    <true/>
</dict>
</plist>
EOF

echo "✅ ${APP_DIR} created. You can zip and distribute it."

