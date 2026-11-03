#!/bin/sh
set -eu
cd "$(dirname "$0")/../.."

name=games-index-smoke-$$
failures=0

cleanup() {
  docker rm -f "$name" >/dev/null 2>&1 || true
  docker rmi "$name" >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker build -q -t "$name" -f index/Dockerfile . >/dev/null
docker run -d --name "$name" "$name" >/dev/null

headers() {
  docker exec "$name" wget -q -S -O /dev/null "http://127.0.0.1$1" 2>&1 || true
}

status() {
  headers "$1" | awk '/^  HTTP\// {code = $2} END {print code}'
}

tries=0
until [ "$(status /)" = 200 ]; do
  tries=$((tries + 1))
  if [ "$tries" -ge 20 ]; then
    echo "not ok the container did not answer 200 on /"
    exit 1
  fi
  sleep 0.5
done

check() {
  actual=$(status "$2")
  if [ "$actual" = "$3" ]; then
    echo "ok $1 $2 answers $actual"
  else
    echo "not ok $1 $2 answers $actual, expected $3"
    failures=$((failures + 1))
  fi
}

check 1-4 /1-4-unknown 404
check 1-4 /1-4-unknown/ 404
check 1-4 /_assets/1-4-unknown.css 404

if headers / | grep -qi '^  set-cookie:'; then
  echo "not ok 1-3 / sets a cookie"
  failures=$((failures + 1))
else
  echo "ok 1-3 / sets no cookie"
fi

exit "$failures"
