#!/bin/bash
# Renders the app icons in html/icons from the SVG sources in icons/.
# Needs rsvg-convert (brew install librsvg), or runs it in Docker when it is missing.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"

render() {
  local source=$1 size=$2 target=$3
  if command -v rsvg-convert >/dev/null; then
    rsvg-convert -w "$size" -h "$size" "$root/icons/$source" -o "$root/html/icons/$target"
  else
    docker run --rm -v "$root:/site" alpine:3.20 sh -c \
      "apk add -q rsvg-convert && rsvg-convert -w $size -h $size /site/icons/$source -o /site/html/icons/$target"
  fi
}

# The mark on paper, about 60% of the canvas; iOS rounds the corners itself.
render icon.svg 192 icon-192.png
render icon.svg 512 icon-512.png
render icon.svg 180 apple-touch-icon.png
# Android crops maskable icons to a shape, so the mark stays inside the 80% safe zone.
render icon-maskable.svg 512 icon-maskable-512.png
ls -l "$root/html/icons"
