#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
EXT_DIR="$ROOT_DIR/extensions/github-pr"
ZIP_PATH="$ROOT_DIR/downloads/github-pr-extension.zip"

if [ ! -d "$EXT_DIR" ]; then
  echo "Missing extension directory: $EXT_DIR" >&2
  exit 1
fi

if [ ! -f "$EXT_DIR/manifest.json" ]; then
  echo "Missing manifest.json in: $EXT_DIR" >&2
  exit 1
fi

mkdir -p "$ROOT_DIR/downloads"

if command -v jq >/dev/null 2>&1; then
  VERSION=$(jq -r '.version // ""' "$EXT_DIR/manifest.json")
else
  VERSION=$(grep -o '"version"[[:space:]]*:[[:space:]]*"[^"]*"' "$EXT_DIR/manifest.json" | sed 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/' || echo "")
fi

rm -f "$ZIP_PATH"
(
  cd "$EXT_DIR"
  zip -r "$ZIP_PATH" .
)

echo "Built: $ZIP_PATH"
echo "Version: ${VERSION:-N/A}"
