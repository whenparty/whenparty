#!/bin/sh
set -eu
cd "$(dirname "$0")/.."

network=wp_games
proxy=games-e2e-nginx
export TURN_SECRET=e2e-test-secret
work=$(mktemp -d)
started=''

cleanup() {
  for folder in $started; do
    docker compose -f "$folder/compose.yml" down --remove-orphans >/dev/null 2>&1 || true
  done
  docker rm -f "$proxy" >/dev/null 2>&1 || true
  docker network rm "$network" >/dev/null 2>&1 || true
  rm -rf "$work"
}

image_of() {
  folder=$1
  shift
  for pair in "$@"; do
    if [ "${pair%%=*}" = "games/$folder" ]; then
      echo "${pair#*=}"
      return
    fi
  done
  echo "e2e.sh: no image given for games/$folder" >&2
  return 1
}

docker network create "$network" >/dev/null
trap cleanup EXIT
trap 'exit 130' INT TERM

for compose in */compose.yml */*/compose.yml; do
  folder=${compose%/compose.yml}
  if [ -f "$folder/Dockerfile" ]; then
    started="$started $folder"
    image=$(image_of "$folder" "$@")
    if ! IMAGE=$image docker compose -f "$compose" up -d --wait --wait-timeout 60; then
      docker compose -f "$compose" logs >&2
      exit 1
    fi
  fi
done
started="$started platform/turn"
docker compose -f platform/turn/compose.yml up -d --wait --wait-timeout 60

cp -R ../infra/nginx/conf.d "$work/conf.d"
sed 's/^ssl_verify_client on;$/ssl_verify_client off;/' "$work/conf.d/default.conf" > "$work/default.conf"
mv "$work/default.conf" "$work/conf.d/default.conf"
mkdir "$work/certs"
for domain in when.party nii.au; do
  openssl req -x509 -newkey rsa:2048 -nodes -days 1 -subj "/CN=$domain" \
    -keyout "$work/certs/$domain.key" -out "$work/certs/$domain.crt" 2>/dev/null
done
chmod -R a+rX "$work"
docker run -d --name "$proxy" --network "$network" -p 127.0.0.1:443:443 \
  -v "$work/conf.d:/etc/nginx/conf.d:ro" -v "$work/certs:/etc/nginx/certs:ro" \
  "$(docker compose -f ../infra/docker-compose.yml config --images)" >/dev/null

tries=0
until [ "$(curl -sk -o /dev/null -w '%{http_code}' --resolve games.when.party:443:127.0.0.1 https://games.when.party/)" = 200 ]; do
  tries=$((tries + 1))
  if [ "$tries" -ge 30 ]; then
    echo 'nginx did not pass https://games.when.party/ to the index page in 30 tries' >&2
    docker logs "$proxy" 2>&1 | tail -20 >&2
    exit 1
  fi
  sleep 1
done

if ! GAMES_E2E=1 pnpm exec playwright test; then
  echo 'Statuses that nginx answered:' >&2
  docker logs "$proxy" 2>/dev/null | awk '{print $9}' | sort | uniq -c >&2
  exit 1
fi
