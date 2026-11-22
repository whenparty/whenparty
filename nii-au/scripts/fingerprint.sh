#!/bin/sh
set -eu
cd "$1"

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

for asset in media/*; do
  fingerprint "$asset" index.html styles.css script.js
done
fingerprint styles.css index.html
fingerprint script.js index.html

assets=""
for file in media/* styles.*.css script.*.js; do
  assets="$assets${assets:+,}\"/$file\""
done
sed -i "s#^const ASSETS = \[\]#const ASSETS = [$assets]#" sw.js
if ! grep -q '^const ASSETS = \["/' sw.js; then
  echo "fingerprint.sh: could not fill ASSETS in sw.js" >&2
  exit 1
fi
