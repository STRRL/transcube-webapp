#!/bin/bash

set -e

# Check prerequisites
echo "Checking prerequisites..."

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

echo "Prerequisites satisfied."
echo ""

# First, run the build script
echo "Running build script..."
./scripts/build.sh

# Get git tag
GIT_TAG=$(git describe --tags --exact-match 2>/dev/null || echo "")
if [[ -z "$GIT_TAG" ]]; then
    echo ""
    echo "No git tag found. Skipping GitHub release creation."
    echo "To create a release, tag your commit first:"
    echo "  git tag v0.1.2"
    echo "  git push origin v0.1.2"
    exit 0
fi

VERSION="${GIT_TAG#v}"
echo ""
echo "Creating GitHub release for $GIT_TAG..."

# Determine commit to target for the release/tag
TARGET_SHA=$(git rev-list -n 1 "$GIT_TAG" 2>/dev/null || git rev-parse HEAD)
CREATE_ARGS=()

# Ensure the tag exists on origin, otherwise try to push it or fall back to --target
if ! git ls-remote --tags origin "$GIT_TAG" | grep -q "$GIT_TAG"; then
    echo "Tag $GIT_TAG not found on origin. Attempting to push it..."
    if git push origin "$GIT_TAG"; then
        echo "Pushed tag $GIT_TAG to origin."
    else
        echo "Unable to push tag. Will create release with --target $TARGET_SHA"
        CREATE_ARGS=(--target "$TARGET_SHA")
    fi
fi

# Collect assets to upload (currently DMG on macOS if present)
ASSETS=()
DMG_NAME="TransCube-${VERSION}-macOS.dmg"
if [[ -f "build/bin/$DMG_NAME" ]]; then
    ASSETS+=("build/bin/$DMG_NAME")
fi

# Check if release already exists
if gh release view "$GIT_TAG" &> /dev/null; then
    echo "Release $GIT_TAG already exists. Uploading assets..."
    if [[ ${#ASSETS[@]} -gt 0 ]]; then
        gh release upload "$GIT_TAG" "${ASSETS[@]}" --clobber
    else
        echo "No assets to upload. Skipping asset upload."
    fi
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
        "${CREATE_ARGS[@]}" \
        "${ASSETS[@]}"
fi

echo "Release created/updated: https://github.com/$(gh repo view --json nameWithOwner -q .nameWithOwner)/releases/tag/$GIT_TAG"