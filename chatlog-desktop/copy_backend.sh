#!/bin/bash

# Copy the chatlog binary into the packaged app
set -e

APP_PATH="release/0.0.0/mac-arm64/Chatlog.app"
RESOURCES_PATH="$APP_PATH/Contents/Resources"

# Create Resources directory if it doesn't exist
mkdir -p "$RESOURCES_PATH"

# Copy the chatlog binary
echo "Copying chatlog binary to $RESOURCES_PATH/chatlog..."
if [ -f "../../bin/chatlog" ]; then
    cp "../../bin/chatlog" "$RESOURCES_PATH/chatlog"
elif [ -f "../../bin/chatlog_darwin_arm64" ]; then
    cp "../../bin/chatlog_darwin_arm64" "$RESOURCES_PATH/chatlog"
else
    echo "No suitable chatlog binary found in ../../bin/"
    exit 1
fi

# Make it executable
chmod +x "$RESOURCES_PATH/chatlog"

echo "Backend binary copied successfully!"
echo "Binary location: $RESOURCES_PATH/chatlog"

# Verify the binary exists and is executable
if [ -f "$RESOURCES_PATH/chatlog" ]; then
    echo "✓ Binary copied successfully"
    ls -la "$RESOURCES_PATH/chatlog"
else
    echo "✗ Failed to copy binary"
    exit 1
fi