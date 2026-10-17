#!/bin/sh
# Renames assets to name.<hash>.ext and rewrites their references, so nginx.conf
# can serve them as immutable. Runs in the Docker build on the copied html/.
# Usage: fingerprint.sh <html dir>
set -eu
cd "$1"

# fingerprint <asset> <files that reference it...>
fingerprint() {
  asset=$1
  shift
  if ! grep -qF "/$asset" "$@"; then
    echo "fingerprint.sh: nothing references /$asset" >&2
    exit 1
  fi
  hash=$(sha256sum "$asset" | cut -c1-10)
  hashed="${asset%.*}.$hash.${asset##*.}"
  mv "$asset" "$hashed"
  pattern=$(printf '%s' "/$asset" | sed 's/[.]/\\./g')
  sed -i "s#$pattern#/$hashed#g" "$@"
}

# Media first: their new names change the content, and so the hashes, of the
# files that reference them.
for asset in media/*; do
  fingerprint "$asset" index.html styles.css script.js
done
fingerprint styles.css index.html
fingerprint script.js index.html
