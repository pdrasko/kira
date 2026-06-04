#!/usr/bin/env bash
# Bump patch version in js/version.js and update importmap cache-bust URLs.
# Skips if the file being edited IS version.js (prevents infinite loop).

set -euo pipefail

INPUT=$(cat)
echo "$INPUT" | grep -q "version\.js" && exit 0

REPO="$(cd "$(dirname "$0")/../.." && pwd)"
FILE="$REPO/js/version.js"
HTML="$REPO/index.html"

[ -f "$FILE" ] || exit 0

CURRENT=$(grep -oE "[0-9]+\.[0-9]+\.[0-9]+" "$FILE" | head -1)
[ -z "$CURRENT" ] && exit 0

IFS='.' read -ra PARTS <<< "$CURRENT"
MAJOR="${PARTS[0]}"
MINOR="${PARTS[1]}"
PATCH="${PARTS[2]}"
NEW_PATCH=$((PATCH + 1))
NEW_VERSION="$MAJOR.$MINOR.$NEW_PATCH"

sed -i "s/$CURRENT/$NEW_VERSION/" "$FILE"
sed -i "s/\?v=$CURRENT/?v=$NEW_VERSION/g" "$HTML"
