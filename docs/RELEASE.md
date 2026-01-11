# Release Guide

This document covers the complete release process for TransCube, including building, code signing, notarization, GitHub release, and Homebrew distribution.

## Quick Start

```bash
git tag v1.0.0
git push origin v1.0.0
./scripts/build-and-release.sh
```

Then update Homebrew tap (see [Homebrew Distribution](#homebrew-distribution)).

## Prerequisites

- **Apple Developer Program** ($99/year) - Required for code signing and notarization
- **Developer ID Application certificate** - Installed in Keychain
- **GitHub CLI (`gh`)** - Authenticated with `gh auth login`
- **Wails CLI** - `go install github.com/wailsapp/wails/v2/cmd/wails@latest`
- **jq** - `brew install jq`
- **Xcode Command Line Tools** - `xcode-select --install`

## Environment Setup

### 1. Copy the example file

```bash
cp .env.example .env
```

### 2. Configure credentials

Edit `.env` with your values:

```bash
APPLE_DEVELOPER_IDENTITY="Developer ID Application: Your Name (TEAMID)"
APPLE_ID="your-apple-id@example.com"
APPLE_APP_PASSWORD="xxxx-xxxx-xxxx-xxxx"
APPLE_TEAM_ID="XXXXXXXXXX"
```

### How to get each value

| Variable | Where to find |
|----------|---------------|
| `APPLE_DEVELOPER_IDENTITY` | Run `security find-identity -v -p codesigning` |
| `APPLE_ID` | Your Apple Developer account email |
| `APPLE_APP_PASSWORD` | Generate at [appleid.apple.com](https://appleid.apple.com) → Sign-In and Security → App-Specific Passwords |
| `APPLE_TEAM_ID` | [Apple Developer Portal](https://developer.apple.com/account) → Membership → Team ID |

## Certificate Setup

If you don't have a Developer ID certificate yet:

1. **Generate CSR**: Open Keychain Access → Certificate Assistant → Request a Certificate From a Certificate Authority
2. **Create certificate**: Go to [Apple Developer Portal](https://developer.apple.com/account/resources/certificates/list) → Create a "Developer ID Application" certificate
3. **Install**: Download and double-click to install in Keychain
4. **Verify**: Run `security find-identity -v -p codesigning`

## Release Workflow

### Step 1: Create and push git tag

```bash
git tag v1.0.0
git push origin v1.0.0
```

### Step 2: Run release script

```bash
./scripts/build-and-release.sh
```

This script:
1. Checks prerequisites (`gh`, `wails`, `jq`, `xcrun`, `codesign`)
2. Validates `.env` configuration
3. Updates version in `wails.json` from git tag
4. Builds the app with Wails
5. Renames to `TransCube.app` and replaces icon
6. Code signs the app
7. Creates DMG installer
8. Signs and notarizes the DMG
9. Creates GitHub release and uploads DMG

### Step 3: Verify

Check the release at:
```
https://github.com/user/repo/releases/tag/v1.0.0
```

## Script Reference

| Script | Purpose | When to Use |
|--------|---------|-------------|
| `build-and-release.sh` | Full workflow (build → sign → notarize → GitHub release) | Normal releases |
| `build.sh` | Build, sign, and notarize only | Local testing without publishing |
| `sign-and-notarize.sh` | Sign an existing app | Re-signing pre-built apps |

## Version Management

- Version is extracted from the git tag (e.g., `v1.0.0` → `1.0.0`)
- The script temporarily updates `wails.json` during build
- If no git tag exists, version defaults to `0.0.0`
- Follow [Semantic Versioning](https://semver.org/): `vMAJOR.MINOR.PATCH`

## Homebrew Distribution

After the GitHub release is published, update the Homebrew tap:

### 1. Get the DMG URL

Copy the download URL from your GitHub release page.

### 2. Calculate SHA256

```bash
shasum -a 256 build/bin/TransCube-1.0.0-macOS.dmg
```

### 3. Update the tap repository

```bash
git clone https://github.com/strrl/homebrew-collective.git
cd homebrew-collective
```

Edit `Casks/transcube.rb`:
- Update `version "1.0.0"`
- Update `sha256 "abc123..."`
- Update download URL if needed

### 4. Submit PR

```bash
git add Casks/transcube.rb
git commit -m "Update transcube to v1.0.0"
git push origin main
```

After merge, users can upgrade with:
```bash
brew upgrade transcube
```

## Troubleshooting

### Missing `.env` / Environment variables not set

```
Error: APPLE_DEVELOPER_IDENTITY is not set.
```

**Solution**: Copy `.env.example` to `.env` and fill in your credentials.

### Certificate not found

```
Error: identity not found
```

**Solution**:
1. Check available certificates: `security find-identity -v -p codesigning`
2. Ensure the exact certificate name matches `APPLE_DEVELOPER_IDENTITY`

### Notarization failed

```
Error: Notarization failed
```

**Solution**:
1. Check notarization log: `xcrun notarytool log <submission-id> --apple-id $APPLE_ID --password $APPLE_APP_PASSWORD --team-id $APPLE_TEAM_ID`
2. Common causes:
   - Missing entitlements
   - Hardened runtime not enabled
   - Binary not properly signed

### GitHub CLI not authenticated

```
Error: Not authenticated with GitHub.
```

**Solution**: Run `gh auth login` and follow the prompts.

### Gatekeeper rejection

```
spctl -a -t exec -vvv build/bin/TransCube.app
# rejected
```

**Solution**:
1. Ensure you're using "Developer ID Application" certificate (not "Apple Development")
2. Verify notarization completed: `stapler validate build/bin/TransCube.app`

## Verification Commands

```bash
# Check code signature
codesign --verify --verbose=2 build/bin/TransCube.app

# Check Gatekeeper acceptance
spctl -a -t exec -vvv build/bin/TransCube.app

# Check notarization status
stapler validate build/bin/TransCube.app

# Check DMG signature
codesign --verify --verbose=2 build/bin/TransCube-*.dmg
```

## Reference Links

- [Apple Developer - Notarizing macOS Software](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution)
- [Wails Documentation - Code Signing](https://wails.io/docs/guides/signing)
- [Cheatsheet for macOS App Signing](https://strrl.dev/post/2024/cheatsheet-for-macos-app-signing-and-notatizing/)
