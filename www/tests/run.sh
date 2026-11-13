#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
version=$(sed -n 's/.*"@playwright\/test": "\(.*\)".*/\1/p' package.json)
exec docker run --rm --init --ipc=host -e CI -v "$PWD:/www" -w /www "mcr.microsoft.com/playwright:v$version-noble" \
  sh -c 'npm ci --no-audit --no-fund && npx playwright test "$@"' sh "$@"
