#!/bin/bash

set -e

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
wails build -clean

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

echo "Done! Build available in build/bin/"