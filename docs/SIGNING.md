# macOS App Signing and Notarization Guide

## Overview

This document explains how to sign and notarize the TransCube app for distribution on macOS.

Ref: https://strrl.dev/post/2024/cheatsheet-for-macos-app-signing-and-notatizing/

## Prerequisites

1. **Apple Developer Account**
   - Valid Apple Developer Program membership ($99/year) for distribution
   - Free Apple Developer account can only be used for development testing

2. **Certificate Preparation**
   - **Developer ID Application**: For distribution outside Mac App Store
   - **Apple Distribution**: For Mac App Store distribution
   - Generate CSR from Keychain Access and download certificates from Apple Developer portal

## Configuration

### Environment Variables Setup

1. Copy the example environment file:
```bash
cp .env.example .env
```

2. Edit `.env` with your credentials:
```bash
APPLE_DEVELOPER_IDENTITY="Developer ID Application: Your Name (TEAMID)"
APPLE_ID="your-apple-id@example.com"
APPLE_APP_PASSWORD="xxxx-xxxx-xxxx-xxxx"
APPLE_TEAM_ID="TEAMID"
```

3. Keep `.env` secure and never commit it to version control (it's already in `.gitignore`)

## Signing Process

### 1. Generate Certificates

1. Open Keychain Access and generate a Certificate Signing Request (CSR)
2. Go to Apple Developer portal and create certificates:
   - "Developer ID Application" for distribution outside Mac App Store
   - "Apple Distribution" for Mac App Store
3. Download and install certificates in Keychain

### 2. Check Available Certificates

```bash
security find-identity -v -p codesigning
```

### 3. Using the Automation Script

We provide an automation script `scripts/sign-and-notarize.sh`:

```bash
# Method 1: Using .env file (recommended)
cp .env.example .env
# Edit .env with your credentials
./scripts/sign-and-notarize.sh

# Method 2: Using environment variables
export APPLE_DEVELOPER_IDENTITY="Developer ID Application: Your Name (TEAMID)"
export APPLE_ID="your-apple-id@example.com"
export APPLE_APP_PASSWORD="xxxx-xxxx-xxxx-xxxx"  # App-specific password
export APPLE_TEAM_ID="TEAMID"
./scripts/sign-and-notarize.sh

# Method 3: Inline for one-time use
APPLE_DEVELOPER_IDENTITY="Your Certificate Name" ./scripts/sign-and-notarize.sh
```

### 4. Manual Signing

If you need to sign manually:

```bash
# Build the app
wails build -platform darwin/universal

# Sign
codesign --deep --force --verify --verbose \
  --sign "Your Developer ID" \
  --options runtime \
  --entitlements build/darwin/entitlements.plist \
  build/bin/transcube-webapp.app

# Verify
codesign --verify --verbose build/bin/transcube-webapp.app
```

## Notarization Process

Notarization is required for macOS 10.15+ to ensure the app can run on other Macs.

### 1. Create App-Specific Password

1. Sign in to [appleid.apple.com](https://appleid.apple.com)
2. In the "Sign-In and Security" section, select "App-Specific Passwords"
3. Generate a new password and save it

### 2. Submit for Notarization

```bash
# Create ZIP
ditto -c -k --keepParent build/bin/transcube-webapp.app build/bin/transcube-webapp.zip

# Submit
xcrun notarytool submit build/bin/transcube-webapp.zip \
  --apple-id "your-apple-id@example.com" \
  --password "app-specific-password" \
  --team-id "TEAMID" \
  --wait

# Staple ticket
xcrun stapler staple build/bin/transcube-webapp.app
```

## Entitlements Description

The `build/darwin/entitlements.plist` file defines app permissions:

- `com.apple.security.cs.allow-jit`: Allow JIT (required for WebView)
- `com.apple.security.network.client`: Network access permission
- `com.apple.security.files.user-selected.read-write`: File read/write permissions

## Verification Tools

### Apparency
Use [Apparency](https://mothersruin.com/software/Apparency/get.html) to check app signing status visually.

### Command Line Verification
```bash
# Check signature
codesign --verify --verbose=2 build/bin/transcube-webapp.app

# Check Gatekeeper acceptance
spctl -a -t exec -vvv build/bin/transcube-webapp.app

# Check notarization status
stapler validate build/bin/transcube-webapp.app
```

## Common Issues

### Certificate Revoked

If you encounter `CSSMERR_TP_CERT_REVOKED` error, the certificate has been revoked. You need to:
1. Regenerate the certificate in Xcode
2. Or contact Apple Developer Support

### App Rejected by Gatekeeper

If `spctl` verification shows "rejected":
1. Ensure you're using the correct Developer ID certificate
2. Ensure correct entitlements are included
3. Consider notarization

### Notarization Failed

Common causes:
1. Missing required entitlements
2. Using wrong certificate type
3. Binary not properly signed

## Distribution Options

### 1. Direct Distribution (requires notarization)
- Sign with Developer ID Application certificate
- Complete notarization process
- Can distribute via website or other channels

### 2. Mac App Store
- Use Apple Distribution certificate
- Submit through App Store Connect
- Requires additional review process

### 3. Enterprise Distribution
- Requires Apple Developer Enterprise Program
- Can distribute internally without App Store

## CI/CD Integration

You can integrate signing in CI/CD:

```yaml
# GitHub Actions example
- name: Sign and Notarize
  env:
    APPLE_DEVELOPER_IDENTITY: ${{ secrets.APPLE_DEVELOPER_IDENTITY }}
    APPLE_ID: ${{ secrets.APPLE_ID }}
    APPLE_APP_PASSWORD: ${{ secrets.APPLE_APP_PASSWORD }}
    APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
  run: |
    ./scripts/sign-and-notarize.sh
```

## Reference Links

- [Apple Developer - Notarizing macOS Software](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution)
- [Wails Documentation - Code Signing](https://wails.io/docs/guides/signing)
- [Apple Developer - Code Signing Guide](https://developer.apple.com/library/archive/documentation/Security/Conceptual/CodeSigningGuide/)