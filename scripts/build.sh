#!/bin/bash

set -e

# Check prerequisites
echo "Checking prerequisites..."

if ! command -v wails &> /dev/null; then
    echo "Error: Wails is not installed."
    echo "Install it with: go install github.com/wailsapp/wails/v2/cmd/wails@latest"
    exit 1
fi

if [[ "$OSTYPE" == "darwin"* ]]; then
    if ! command -v xcrun &> /dev/null; then
        echo "Error: Xcode Command Line Tools not installed."
        echo "Install it with: xcode-select --install"
        exit 1
    fi
    
    if ! command -v codesign &> /dev/null; then
        echo "Error: codesign not found."
        echo "Make sure Xcode Command Line Tools are properly installed."
        exit 1
    fi
fi

echo "All prerequisites satisfied."
echo ""

# Get git tag or use latest commit
GIT_TAG=$(git describe --tags --exact-match 2>/dev/null || echo "")
if [[ -n "$GIT_TAG" ]]; then
    VERSION="${GIT_TAG#v}"
else
    VERSION="0.0.0"
fi

# Update version in wails.json
sed -i '' "s/\"productVersion\": \".*\"/\"productVersion\": \"$VERSION\"/" wails.json

# Build
echo "Building version $VERSION..."
# Enforce minimum macOS version at link time when building on macOS
if [[ "$OSTYPE" == "darwin"* ]]; then
    export MACOSX_DEPLOYMENT_TARGET="26.0"
fi
wails build -clean

# Restore version to 0.0.1
echo "Restoring version to 0.0.1..."
sed -i '' "s/\"productVersion\": \".*\"/\"productVersion\": \"0.0.1\"/" wails.json

# Rename app on macOS
if [[ "$OSTYPE" == "darwin"* ]] && [ -d "build/bin/transcube-webapp.app" ]; then
    echo "Renaming app to TransCube.app..."
    mv build/bin/transcube-webapp.app build/bin/TransCube.app
fi

# Replace icon with custom appicon.icns
if [[ "$OSTYPE" == "darwin"* ]] && [ -d "build/bin/TransCube.app" ] && [ -f "build/appicon.icns" ]; then
    echo "Replacing app icon..."
    cp build/appicon.icns build/bin/TransCube.app/Contents/Resources/iconfile.icns
fi

# Sign and notarize (macOS only)
if [[ "$OSTYPE" == "darwin"* ]] && [ -f ".env" ]; then
    source .env
    
    if [[ -n "$APPLE_DEVELOPER_IDENTITY" ]]; then
        echo "Signing..."
        codesign --deep --force --verify --verbose \
            --sign "$APPLE_DEVELOPER_IDENTITY" \
            --options runtime \
            --entitlements build/darwin/entitlements.plist \
            --timestamp \
            build/bin/TransCube.app
        
        if [[ -n "$APPLE_ID" ]] && [[ -n "$APPLE_APP_PASSWORD" ]] && [[ -n "$APPLE_TEAM_ID" ]]; then
            echo "Notarizing..."
            ditto -c -k --keepParent build/bin/TransCube.app build/bin/TransCube.zip
            xcrun notarytool submit build/bin/TransCube.zip \
                --apple-id "$APPLE_ID" \
                --password "$APPLE_APP_PASSWORD" \
                --team-id "$APPLE_TEAM_ID" \
                --wait
            xcrun stapler staple build/bin/TransCube.app
            rm build/bin/TransCube.zip
        fi
    fi
fi

# Create DMG
echo "Creating DMG..."
if [[ "$OSTYPE" == "darwin"* ]] && [ -d "build/bin/TransCube.app" ]; then
    DMG_NAME="TransCube-${VERSION}-macOS.dmg"
    hdiutil create -volname "TransCube" \
        -srcfolder "build/bin/TransCube.app" \
        -ov -format UDZO \
        "build/bin/$DMG_NAME"
    echo "Created $DMG_NAME"
fi

echo "Done! Build available in build/bin/"