#!/bin/bash

set -e

HOMEBREW_TAP_REPO="STRRL/homebrew-collective"
CASK_NAME="transcube"
TEMP_DIR=$(mktemp -d)

cleanup() {
    rm -rf "$TEMP_DIR"
}
trap cleanup EXIT

echo "Updating Homebrew cask for $CASK_NAME..."
echo ""

if [[ $# -eq 1 ]]; then
    VERSION="$1"
else
    GIT_TAG=$(git describe --tags --exact-match 2>/dev/null || echo "")
    if [[ -z "$GIT_TAG" ]]; then
        echo "Error: No version specified and no git tag found."
        echo "Usage: $0 [VERSION]"
        echo "Example: $0 0.1.10"
        exit 1
    fi
    VERSION="${GIT_TAG#v}"
fi

echo "Version: $VERSION"

DMG_NAME="TransCube-${VERSION}-macOS.dmg"
DMG_PATH="build/bin/$DMG_NAME"

if [[ ! -f "$DMG_PATH" ]]; then
    echo "Error: DMG file not found at $DMG_PATH"
    echo "Please run build-and-release.sh first."
    exit 1
fi

echo "Calculating SHA256 for $DMG_NAME..."
SHA256=$(shasum -a 256 "$DMG_PATH" | awk '{print $1}')
echo "SHA256: $SHA256"
echo ""

echo "Cloning homebrew-collective repository..."
cd "$TEMP_DIR"
git clone "https://github.com/$HOMEBREW_TAP_REPO.git" tap
cd tap

CASK_FILE="Casks/${CASK_NAME}.rb"

if [[ ! -f "$CASK_FILE" ]]; then
    echo "Error: Cask file not found at $CASK_FILE"
    exit 1
fi

echo "Updating $CASK_FILE..."

sed -i '' "s/version \".*\"/version \"$VERSION\"/" "$CASK_FILE"
sed -i '' "s/sha256 \".*\"/sha256 \"$SHA256\"/" "$CASK_FILE"

if git diff --quiet "$CASK_FILE"; then
    echo "No changes detected in $CASK_FILE. Version might already be up to date."
    exit 0
fi

echo ""
echo "Changes to be committed:"
git diff "$CASK_FILE"
echo ""

git add "$CASK_FILE"
git commit -m "chore: update $CASK_NAME to $VERSION"

echo "Pushing to $HOMEBREW_TAP_REPO..."
git push origin master

echo ""
echo "Successfully updated Homebrew cask to version $VERSION"
echo "Users can now run: brew upgrade $CASK_NAME"
