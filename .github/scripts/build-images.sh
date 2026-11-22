#!/bin/sh
set -eu

for folder in "$@"; do
  if [ ! -f "$folder/Dockerfile" ]; then
    continue
  fi
  echo "::group::$folder"
  image="whenparty-games/$(basename "$folder")"
  docker build -t "$image" -f "$folder/Dockerfile" games
  container=$(docker run -d --health-interval 1s "$image")
  state=
  for _ in $(seq 30); do
    state=$(docker inspect -f '{{.State.Status}} {{if .State.Health}}{{.State.Health.Status}}{{else}}without a health check{{end}}' "$container")
    [ "$state" = 'running starting' ] || break
    sleep 1
  done
  if [ "$state" != 'running healthy' ]; then
    docker logs "$container"
    case $state in
      *'without a health check') echo "::error::$folder: the image has no health check" ;;
      *) echo "::error::$folder: the container did not pass its health check within 30 seconds ($state)" ;;
    esac
    exit 1
  fi
  docker rm -f "$container" > /dev/null
  echo "::endgroup::"
done
