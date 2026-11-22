#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
playwright=$(sed -n 's/.*"@playwright\/test": "\(.*\)".*/\1/p' package.json)
pnpm=$(sed -n 's/.*"packageManager": "pnpm@\([^+"]*\).*/\1/p' package.json)
image=www-tests:$playwright-$pnpm
docker build --quiet --tag "$image" - >/dev/null <<EOF
FROM mcr.microsoft.com/playwright:v$playwright-noble
COPY --from=ghcr.io/pnpm/pnpm:$pnpm /opt/pnpm /opt/pnpm
EOF
exec docker run --rm --init --ipc=host -e CI \
  -v "$PWD:/www" -v /www/node_modules -v www-tests-pnpm:/pnpm-store -w /www "$image" \
  sh -c '/opt/pnpm/pnpm install --frozen-lockfile --store-dir /pnpm-store && /opt/pnpm/pnpm exec playwright test "$@"' sh "$@"
