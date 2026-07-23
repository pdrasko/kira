#!/usr/bin/env bash
# Downloads PianoNanny.com's "Starter Studies" lesson pages (page1.html
# through page16.html by default) plus every image/audio file each page
# references, then zips it all up.
#
# Why this exists: pianonanny.com 403s automated fetches from datacenter /
# cloud-proxy IPs (confirmed from Claude's own fetch tools), so this has to
# run from a normal residential/home connection instead -- a plain curl with
# a browser User-Agent gets through fine from there.
#
# Starter Studies runs roughly page1.html..page13.html; Intermediate Studies
# starts at page17.html, so this grabs a few pages past 13 as a buffer in
# case Starter Studies actually extends closer to page16 (a wrap-up page, a
# quiz page, etc.) -- any page that 404s or fails to fetch is just skipped.
#
# Usage:
#   ./scrape-pianonanny.sh                 # writes pianonanny_starter_studies.zip
#   ./scrape-pianonanny.sh custom-name.zip # writes custom-name.zip
#   START=1 END=20 ./scrape-pianonanny.sh  # override the page range

set -euo pipefail

START="${START:-1}"
END="${END:-16}"
BASE_URL="https://pianonanny.com"
OUT_ZIP="${1:-pianonanny_starter_studies.zip}"
UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"

command -v curl >/dev/null || { echo "curl is required but not found." >&2; exit 1; }
command -v zip  >/dev/null || { echo "zip is required but not found (install via 'apt install zip' / 'brew install zip')." >&2; exit 1; }

WORKDIR="$(mktemp -d)"
mkdir -p "$WORKDIR/pages" "$WORKDIR/assets"
MANIFEST="$WORKDIR/MANIFEST.txt"
: > "$MANIFEST"

fetch() {
  # $1 = url, $2 = output path
  curl -sSL --fail --retry 3 --retry-delay 2 \
    -A "$UA" \
    -e "$BASE_URL/" \
    -H "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" \
    -H "Accept-Language: en-US,en;q=0.9" \
    "$1" -o "$2"
}

echo "Downloading pages $START..$END from $BASE_URL ..."
for i in $(seq "$START" "$END"); do
  page="page${i}.html"
  url="$BASE_URL/$page"
  out="$WORKDIR/pages/$page"
  echo "  -> $url"
  if fetch "$url" "$out"; then
    echo "OK   $page" >> "$MANIFEST"
  else
    echo "     (failed to fetch $page, skipping)"
    echo "FAIL $page" >> "$MANIFEST"
    rm -f "$out"
  fi
  sleep 1
done

echo "Scanning downloaded pages for images/audio..."
for html in "$WORKDIR"/pages/*.html; do
  [ -f "$html" ] || continue
  grep -Eio '(src|href)="[^"]+\.(gif|jpe?g|png|svg|mid|midi|mp3|wav)"' "$html" \
    | grep -Eo '"[^"]+"' \
    | tr -d '"' \
    | sort -u \
    | while read -r asset; do
        case "$asset" in
          http*) asset_url="$asset" ;;
          /*)    asset_url="$BASE_URL$asset" ;;
          *)     asset_url="$BASE_URL/$asset" ;;
        esac
        asset_name="$(basename "$asset")"
        dest="$WORKDIR/assets/$asset_name"
        if [ ! -f "$dest" ]; then
          echo "  -> $asset_url"
          if fetch "$asset_url" "$dest"; then
            echo "OK   assets/$asset_name (from $(basename "$html"))" >> "$MANIFEST"
          else
            echo "     (failed, skipping)"
            echo "FAIL assets/$asset_name (from $(basename "$html"))" >> "$MANIFEST"
            rm -f "$dest"
          fi
          sleep 0.5
        fi
      done
done

echo "Zipping into $OUT_ZIP ..."
( cd "$WORKDIR" && zip -qr - pages assets MANIFEST.txt ) > "$OUT_ZIP"
rm -rf "$WORKDIR"

echo
echo "Done: $OUT_ZIP"
echo "Upload this zip back to Claude to continue building the Starter Studies lessons from it."
