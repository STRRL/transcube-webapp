#!/bin/bash

# macOS app signing and notarization script
# 
# Configuration can be provided via:
# 1. .env file in the project root (recommended)
# 2. Environment variables
# 3. Command line arguments
#
# Required variables:
# - APPLE_DEVELOPER_IDENTITY: Developer certificate identity (e.g., "Developer ID Application: Your Name (TEAMID)")
# - APPLE_ID: Apple ID email
# - APPLE_APP_PASSWORD: App-specific password (get from appleid.apple.com)
# - APPLE_TEAM_ID: Team ID (from Apple Developer portal)
#
# For distribution outside Mac App Store: Use "Developer ID Application" certificate
# For Mac App Store: Use "Apple Distribution" certificate

set -e

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get script directory and project root
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"

# Load .env file if it exists
if [ -f "$PROJECT_ROOT/.env" ]; then
    echo -e "${GREEN}📄 Loading configuration from .env file${NC}"
    set -a
    source "$PROJECT_ROOT/.env"
    set +a
elif [ -f "$PROJECT_ROOT/.env.example" ]; then
    echo -e "${YELLOW}⚠️  No .env file found. Copy .env.example to .env and configure it.${NC}"
fi

echo -e "${GREEN}🔨 Starting Wails app build and signing${NC}"

# Check environment variables
if [ -z "$APPLE_DEVELOPER_IDENTITY" ]; then
    echo -e "${YELLOW}⚠️  Using default developer certificate${NC}"
    APPLE_DEVELOPER_IDENTITY="Apple Development: str_ruiling@outlook.com (PS3DHS7PNY)"
fi

# Build app
echo -e "${GREEN}📦 Building app...${NC}"
# Enforce minimum macOS version at link time
export MACOSX_DEPLOYMENT_TARGET="14.0"
wails build -platform darwin/universal -clean

APP_PATH="build/bin/transcube-webapp.app"

if [ ! -d "$APP_PATH" ]; then
    echo -e "${RED}❌ Build failed, cannot find $APP_PATH${NC}"
    exit 1
fi

# Sign app
echo -e "${GREEN}🔏 Signing app...${NC}"
codesign --deep --force --verify --verbose=2 \
    --sign "$APPLE_DEVELOPER_IDENTITY" \
    --options runtime \
    --entitlements build/darwin/entitlements.plist \
    "$APP_PATH"

# Verify signature
echo -e "${GREEN}✅ Verifying signature...${NC}"
codesign --verify --verbose=2 "$APP_PATH"

# Check Gatekeeper acceptance (may show "rejected" for development certificates)
echo -e "${GREEN}🔍 Checking Gatekeeper...${NC}"
spctl -a -t exec -vvv "$APP_PATH" || {
    echo -e "${YELLOW}⚠️  Gatekeeper check failed (expected for development certificates)${NC}"
}

# Notarize if environment variables are set
if [ ! -z "$APPLE_ID" ] && [ ! -z "$APPLE_APP_PASSWORD" ] && [ ! -z "$APPLE_TEAM_ID" ]; then
    echo -e "${GREEN}📤 Preparing for notarization...${NC}"
    
    # Create ZIP file for notarization
    ZIP_PATH="build/bin/transcube-webapp.zip"
    ditto -c -k --keepParent "$APP_PATH" "$ZIP_PATH"
    
    echo -e "${GREEN}📝 Submitting for notarization...${NC}"
    xcrun notarytool submit "$ZIP_PATH" \
        --apple-id "$APPLE_ID" \
        --password "$APPLE_APP_PASSWORD" \
        --team-id "$APPLE_TEAM_ID" \
        --wait
    
    echo -e "${GREEN}📌 Stapling ticket...${NC}"
    xcrun stapler staple "$APP_PATH"
    
    # Clean up ZIP file
    rm "$ZIP_PATH"
    
    echo -e "${GREEN}✅ Notarization complete!${NC}"
    
    # Verify notarization
    echo -e "${GREEN}🔍 Verifying notarization...${NC}"
    stapler validate "$APP_PATH"
else
    echo -e "${YELLOW}⚠️  Skipping notarization (requires APPLE_ID, APPLE_APP_PASSWORD and APPLE_TEAM_ID)${NC}"
fi

echo -e "${GREEN}🎉 Done! App is located at: $APP_PATH${NC}"
echo -e "${GREEN}💡 Tip: Use Apparency app to visually check signing status${NC}"
echo -e "${GREEN}💡 Download from: https://mothersruin.com/software/Apparency/get.html${NC}"
