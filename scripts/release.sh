#!/bin/bash

set -e

# Check prerequisites
echo "Checking prerequisites..."

if ! command -v wails &> /dev/null; then
    echo "Error: Wails is not installed."
    echo "Install it with: go install github.com/wailsapp/wails/v2/cmd/wails@latest"
    exit 1
fi

if ! command -v gh &> /dev/null; then
    echo "Error: GitHub CLI (gh) is not installed."
    echo "Install it with: brew install gh"
    exit 1
fi

if ! gh auth status &> /dev/null; then
    echo "Error: Not authenticated with GitHub."
    echo "Run: gh auth login"
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
wails build -clean

# Restore version to 0.0.1
echo "Restoring version to 0.0.1..."
sed -i '' "s/\"productVersion\": \".*\"/\"productVersion\": \"0.0.1\"/" wails.json

# Rename app on macOS
if [[ "$OSTYPE" == "darwin"* ]] && [ -d "build/bin/transcube-webapp.app" ]; then
    echo "Renaming app to TransCube.app..."
    mv build/bin/transcube-webapp.app build/bin/TransCube.app
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

# Create GitHub Release if we have a tag
if [[ -n "$GIT_TAG" ]]; then
    echo ""
    echo "Creating GitHub release..."
    
    # Check if release already exists
    if gh release view "$GIT_TAG" &> /dev/null; then
        echo "Release $GIT_TAG already exists. Uploading assets..."
        gh release upload "$GIT_TAG" "build/bin/$DMG_NAME" --clobber
    else
        echo "Creating new release $GIT_TAG..."
        gh release create "$GIT_TAG" \
            --title "Release $GIT_TAG" \
            --notes "## TransCube $VERSION

### Downloads
- **macOS**: Download the DMG file below

### Installation
1. Download the DMG file
2. Open the DMG and drag TransCube to Applications
3. On first launch, you may need to right-click and select 'Open' due to Gatekeeper

### What's New
- Video transcription with AI-powered speech recognition
- Multi-language support
- AI-powered summaries

Built with Wails v2" \
            "build/bin/$DMG_NAME"
    fi
    
    echo "Release created/updated: https://github.com/$(gh repo view --json nameWithOwner -q .nameWithOwner)/releases/tag/$GIT_TAG"
else
    echo ""
    echo "No git tag found. Skipping GitHub release creation."
    echo "To create a release, tag your commit first:"
    echo "  git tag v0.1.2"
    echo "  git push origin v0.1.2"
fi