#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
EXT_DIR="$ROOT_DIR/extensions/work-clock"
ZIP_DIR="$ROOT_DIR/downloads"
ZIP_LATEST="$ZIP_DIR/work-clock-extension.zip"

if [ ! -d "$EXT_DIR" ]; then
  echo "Missing extension directory: $EXT_DIR" >&2
  exit 1
fi

if [ ! -f "$EXT_DIR/manifest.json" ]; then
  echo "Missing manifest.json in: $EXT_DIR" >&2
  exit 1
fi

if command -v jq >/dev/null 2>&1; then
  VERSION=$(jq -r '.version // ""' "$EXT_DIR/manifest.json")
  UPDATED=$(jq -r '.x_last_updated // ""' "$EXT_DIR/manifest.json")
else
  VERSION=$(grep -o '"version"[[:space:]]*:[[:space:]]*"[^"]*"' "$EXT_DIR/manifest.json" | sed 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/')
  UPDATED=$(grep -o '"x_last_updated"[[:space:]]*:[[:space:]]*"[^"]*"' "$EXT_DIR/manifest.json" | sed 's/.*"x_last_updated"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/')
fi

if [ -z "$VERSION" ] || [ -z "$UPDATED" ]; then
  echo "Missing version or x_last_updated in manifest.json" >&2
  exit 1
fi

ZIP_VERSIONED="$ZIP_DIR/work-clock-extension-v${VERSION}.zip"

rm -f "$ZIP_VERSIONED" "$ZIP_LATEST"
(
  cd "$EXT_DIR"
  zip -r "$ZIP_VERSIONED" .
)

cp "$ZIP_VERSIONED" "$ZIP_LATEST"

echo "Built: $ZIP_VERSIONED"
echo "Latest: $ZIP_LATEST"
echo "Version: $VERSION"
echo "Updated: $UPDATED"
