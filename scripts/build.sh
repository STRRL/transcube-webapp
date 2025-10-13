#!/bin/bash

set -e

# Replace productVersion in wails.json with the provided value using jq.
update_product_version() {
  local new_version="$1"
  local tmpfile

  tmpfile=$(mktemp) || {
    echo "Error: Unable to create temporary file for wails.json update."
    return 1
  }

  if ! jq --arg version "$new_version" '.info.productVersion = $version' wails.json > "$tmpfile"; then
    echo "Error: Failed to update productVersion in wails.json."
    rm -f "$tmpfile"
    return 1
  fi

  if ! mv "$tmpfile" wails.json; then
    echo "Error: Unable to overwrite wails.json with updated version."
    rm -f "$tmpfile"
    return 1
  fi
}

ORIGINAL_VERSION=""
VERSION_MODIFIED=false

restore_product_version() {
  if [[ "$VERSION_MODIFIED" == "true" ]]; then
    echo "Restoring version to $ORIGINAL_VERSION..."
    update_product_version "$ORIGINAL_VERSION"
    VERSION_MODIFIED=false
  fi
}

# Check prerequisites
echo "Checking prerequisites..."

if ! command -v wails &> /dev/null; then
    echo "Error: Wails is not installed."
    echo "Install it with: go install github.com/wailsapp/wails/v2/cmd/wails@latest"
    exit 1
fi

if ! command -v jq &> /dev/null; then
    echo "Error: jq is not installed."
    echo "Install it with: brew install jq"
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

# Load signing credentials early and fail fast when missing (macOS only).
if [[ "$OSTYPE" == "darwin"* ]]; then
    if [[ -f ".env" ]]; then
        # shellcheck disable=SC1091
        source .env
    fi

    missing_env=false
    for var in APPLE_DEVELOPER_IDENTITY APPLE_ID APPLE_APP_PASSWORD APPLE_TEAM_ID; do
        if [[ -z "${!var}" ]]; then
            echo "Error: $var is not set. Provide it via environment variable or .env file."
            missing_env=true
        fi
    done

    if [[ "$missing_env" == "true" ]]; then
        echo "Hint: Required signing variables are APPLE_DEVELOPER_IDENTITY, APPLE_ID, APPLE_APP_PASSWORD, APPLE_TEAM_ID."
        exit 1
    fi
fi

# Preserve the original product version so we can restore it later.
ORIGINAL_VERSION=$(jq -r '.info.productVersion' wails.json)
if [[ -z "$ORIGINAL_VERSION" || "$ORIGINAL_VERSION" == "null" ]]; then
    echo "Error: Unable to read info.productVersion from wails.json."
    exit 1
fi
trap restore_product_version EXIT

# Get git tag or use latest commit
GIT_TAG=$(git describe --tags --exact-match 2>/dev/null || echo "")
if [[ -n "$GIT_TAG" ]]; then
    VERSION="${GIT_TAG#v}"
else
    VERSION="0.0.0"
fi

DMG_NAME="TransCube-${VERSION}-macOS.dmg"
DMG_PATH="build/bin/$DMG_NAME"
SIGNING_ENABLED=false
NOTARIZE_ENABLED=false

# Update version in wails.json
update_product_version "$VERSION"
VERSION_MODIFIED=true

# Build
echo "Building version $VERSION..."
# Enforce minimum macOS version at link time when building on macOS
if [[ "$OSTYPE" == "darwin"* ]]; then
    export MACOSX_DEPLOYMENT_TARGET="26.0"
fi
wails build -clean

# Ensure we leave wails.json as we found it before exiting
restore_product_version

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

# Sign and notarize (macOS only).
if [[ "$OSTYPE" == "darwin"* ]]; then
    SIGNING_ENABLED=true
    NOTARIZE_ENABLED=true

    echo "Signing..."
    codesign --deep --force --verify --verbose \
        --sign "$APPLE_DEVELOPER_IDENTITY" \
        --options runtime \
        --entitlements build/darwin/entitlements.plist \
        --timestamp \
        build/bin/TransCube.app
fi

# Create DMG
echo "Creating DMG..."
if [[ "$OSTYPE" == "darwin"* ]] && [ -d "build/bin/TransCube.app" ]; then
    hdiutil create -volname "TransCube" \
        -srcfolder "build/bin/TransCube.app" \
        -ov -format UDZO \
        "$DMG_PATH"
    echo "Created $DMG_NAME"

    if [[ "$SIGNING_ENABLED" == "true" ]]; then
        echo "Signing DMG..."
        codesign --force --verify --verbose \
            --sign "$APPLE_DEVELOPER_IDENTITY" \
            "$DMG_PATH"
    fi

    if [[ "$NOTARIZE_ENABLED" == "true" ]]; then
        echo "Notarizing DMG..."
        xcrun notarytool submit "$DMG_PATH" \
            --apple-id "$APPLE_ID" \
            --password "$APPLE_APP_PASSWORD" \
            --team-id "$APPLE_TEAM_ID" \
            --wait
        xcrun stapler staple build/bin/TransCube.app
        xcrun stapler staple "$DMG_PATH"
    fi
fi

echo "Done! Build available in build/bin/"
