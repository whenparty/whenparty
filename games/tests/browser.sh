#!/bin/sh
set -eu
cd "$(dirname "$0")/.."

turn=platform/turn
image=$(awk '$1 == "image:" {print $2}' "$turn/compose.yml")
playwright=$(sed -n 's/.*"@playwright\/test": "\(.*\)".*/\1/p' package.json)
pnpm=$(sed -n 's/.*"packageManager": "pnpm@\([^+"]*\).*/\1/p' package.json)
name=games-browser-tests-$$
config=$(mktemp)
export GAMES_TURN_HOST=11.11.11.10
export GAMES_TURN_SECRET=browser-test-secret
export GAMES_TURN_ALLOCATION_SECONDS=10

docker network create --internal --subnet 11.11.11.0/24 "$name" >/dev/null
cleanup() {
  docker rm -f "$name" >/dev/null 2>&1 || true
  docker network rm "$name" >/dev/null 2>&1 || true
  rm -f "$config"
}
trap cleanup EXIT

{
  cat "$turn/turnserver.conf"
  echo "max-allocate-lifetime=$GAMES_TURN_ALLOCATION_SECONDS"
} > "$config"
chmod 644 "$config"

docker run -d --name "$name" --network "$name" --ip "$GAMES_TURN_HOST" \
  -e TURN_SECRET="$GAMES_TURN_SECRET" \
  -v "$config:/etc/coturn/turnserver.conf:ro" \
  -v "$PWD/$turn/start.sh:/etc/coturn/start.sh:ro" \
  --read-only --tmpfs /tmp:size=1m,mode=1777 \
  --cap-drop ALL --cap-add NET_BIND_SERVICE --security-opt no-new-privileges:true \
  --entrypoint /bin/sh "$image" /etc/coturn/start.sh >/dev/null

ready=false
for _ in $(seq 1 30); do
  if docker run --rm --network "$name" --entrypoint turnutils_stunclient "$image" "$GAMES_TURN_HOST" >/dev/null 2>&1; then
    ready=true
    break
  fi
  sleep 1
done
if [ "$ready" != true ]; then
  echo 'coturn did not answer STUN in 30 tries' >&2
  docker logs "$name" 2>&1 | tail -30 >&2
  exit 1
fi

if [ -n "${CI:-}" ]; then
  pnpm exec playwright test "$@"
  exit
fi

masks='-v /games/node_modules'
for package in index platform/* titles/*; do
  if [ -f "$package/package.json" ]; then
    masks="$masks -v /games/$package/node_modules"
  fi
done

docker run --rm --init --ipc=host --network host \
  -e GAMES_TURN_HOST -e GAMES_TURN_SECRET -e GAMES_TURN_ALLOCATION_SECONDS -e PNPM=$pnpm \
  -v "$PWD:/games" $masks -v games-browser-tests-pnpm:/pnpm-store -w /games \
  "mcr.microsoft.com/playwright:v$playwright-noble" \
  sh -c 'npm install --global --silent "pnpm@$PNPM" && pnpm install --frozen-lockfile --store-dir /pnpm-store && pnpm exec playwright test "$@"' sh "$@"
