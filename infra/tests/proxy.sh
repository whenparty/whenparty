set -eu

repo=$(cd "$(dirname "$0")/../.." && pwd)
image=$(docker compose -f "$repo/infra/docker-compose.yml" config --images)
network=proxy-test
https_port=18443
http_port=18080
failures=0
label=whenparty.proxy-test
work=''

cleanup() {
  docker ps -aq --filter "label=$label" | xargs docker rm -f >/dev/null 2>&1 || true
  docker network rm "$network" >/dev/null 2>&1 || true
  if [ -n "$work" ]; then rm -rf "$work"; fi
}
trap cleanup EXIT
trap 'exit 130' INT TERM
cleanup
work=$(mktemp -d)
docker network create "$network" >/dev/null

run() {
  name=$1
  shift
  if [ -n "$(docker ps -aq --filter "name=^/$name\$")" ]; then
    echo "not ok a container named $name already runs here, so the test stops"
    exit 1
  fi
  docker run -d --name "$name" --label "$label" --network "$network" "$@" >/dev/null
}

stub() {
  name=$1
  shift
  mkdir -p "$work/stubs/$name"
  printf '%s\n' "$@" > "$work/stubs/$name/default.conf"
  head -c 204800 /dev/zero > "$work/stubs/$name/slow.bin"
  run "$name" -v "$work/stubs/$name:/etc/nginx/conf.d:ro" "$image"
}

echo_stub() {
  stub "$1" "server {
    listen ${2:-80};
    location ~ missing { return 404 'stub 404'; }
    location ~ status-502 { return 502 'stub 502'; }
    location ~ status-504 { return 504 'stub 504'; }
    location = /slow { limit_rate 20k; alias /etc/nginx/conf.d/slow.bin; }
    location / { return 200 '$1 \$host \$request_uri|\$http_x_real_ip|\$http_x_forwarded_for|\$http_x_forwarded_proto|\$http_upgrade|\$http_connection'; }
  }"
}

pause_stub() {
  name=$1
  dir=$work/stubs/$name
  mkdir -p "$dir"
  cat > "$dir/pause.sh" <<'EOF'
read -r request
while read -r header && [ "$header" != "$(printf '\r')" ]; do :; done
answer() { printf 'HTTP/1.1 200 OK\r\nConnection: close\r\n\r\n'; }
upgrade() { printf 'HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n\r\n'; }
parts() { i=0; while [ "$i" -lt "$1" ]; do sleep "$2"; printf '%s' "$3"; i=$((i + 1)); done; }
case "$(printf '%s' "$request" | cut -d ' ' -f 2)" in
  /quick) sleep 0.1; answer; printf x ;;
  /stream) answer; parts 7 0.2 x ;;
  /silent) sleep 1.5; answer; printf x ;;
  /stalled) answer; printf x; sleep 1.5; printf y ;;
  /ws/site) upgrade; parts 7 0.2 s ;;
  /ws/client) upgrade; i=0; while [ "$i" -lt 7 ]; do dd bs=1 count=1 2>/dev/null >/dev/null; i=$((i + 1)); done; printf done ;;
  /ws/silent) upgrade; sleep 1.5; printf late ;;
  *) answer; printf x ;;
esac
EOF
  run "$name" -v "$dir:/stub:ro" "$image" nc -lk -p "${2:-80}" -e sh /stub/pause.sh
}

websocket() {
  {
    printf 'GET %s HTTP/1.1\r\nHost: %s\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n\r\n' "$2" "$1"
    i=0
    while [ "$i" -lt "$3" ]; do sleep 0.2; printf c; i=$((i + 1)); done
    sleep "$4"
  } | openssl s_client -quiet -connect "127.0.0.1:$https_port" -servername "$1" \
    -cert "$work/certs/client.crt" -key "$work/certs/client.key" 2>/dev/null | tr -d '\r' | sed '1,/^$/d' || true
}

proxy_start() {
  certs=$work/certs
  mkdir -p "$certs"
  openssl req -x509 -newkey rsa:2048 -nodes -days 1 -subj /CN=test-cloudflare \
    -keyout "$certs/ca.key" -out "$certs/ca.crt" 2>/dev/null
  openssl req -newkey rsa:2048 -nodes -subj /CN=cloudflare \
    -keyout "$certs/client.key" -out "$certs/client.csr" 2>/dev/null
  openssl x509 -req -in "$certs/client.csr" -CA "$certs/ca.crt" -CAkey "$certs/ca.key" \
    -CAcreateserial -days 1 -out "$certs/client.crt" 2>/dev/null
  openssl req -x509 -newkey rsa:2048 -nodes -days 1 -subj /CN=other-client \
    -keyout "$certs/other-client.key" -out "$certs/other-client.crt" 2>/dev/null
  for domain in when.party nii.au; do
    openssl req -x509 -newkey rsa:2048 -nodes -days 1 -subj "/CN=$domain" \
      -keyout "$certs/$domain.key" -out "$certs/$domain.crt" 2>/dev/null
  done
  cp -R "$repo/infra/nginx/conf.d" "$work/conf.d"
  cp "$certs/ca.crt" "$work/conf.d/cloudflare-origin-pull-ca.pem"
  rm -f "$work/conf.d/cloudflare_real_ip.conf"
  run proxy-test-nginx -p "127.0.0.1:$https_port:443" -p "127.0.0.1:$http_port:80" \
    -v "$work/conf.d:/etc/nginx/conf.d:ro" -v "$certs:/etc/nginx/certs:ro" "$image"
  proxy_wait
}

proxy_wait() {
  tries=0
  until [ "$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$http_port/health")" = 200 ]; do
    tries=$((tries + 1))
    if [ "$tries" -ge 50 ]; then
      echo "not ok the proxy did not start"
      docker logs proxy-test-nginx 2>&1 | tail -5
      exit 1
    fi
    sleep 0.2
  done
}

proxy_reload() {
  docker exec proxy-test-nginx nginx -s reload >/dev/null 2>&1
  sleep 1
}

stop() {
  docker stop "$1" >/dev/null
  docker restart proxy-test-nginx >/dev/null
  proxy_wait
}

proxy_edit() {
  sed "$2" "$work/conf.d/$1" > "$work/edited.conf"
  mv "$work/edited.conf" "$work/conf.d/$1"
  proxy_reload
}

proxy_set_read_timeout() {
  proxy_edit default.conf "s/^proxy_read_timeout .*;\$/proxy_read_timeout $1;/"
}

address() {
  docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' "$1"
}

proxy_set_real_ip() {
  printf '%s\n' "$@" > "$work/conf.d/cloudflare_real_ip.conf"
  proxy_reload
}

request() {
  host=$1
  path=$2
  shift 2
  rm -f "$work/body" "$work/headers"
  curl -s --max-time 30 --cert "$work/certs/client.crt" --key "$work/certs/client.key" -k \
    --resolve "$host:$https_port:127.0.0.1" -o "$work/body" -D "$work/headers" \
    -w '%{http_code}' "$@" "https://$host:$https_port$path" || true
}

burst() {
  burst_start "$@"
  wait
}

burst_start() {
  count=$1
  host=$2
  path=$3
  shift 3
  rm -rf "$work/burst"
  mkdir -p "$work/burst"
  i=0
  while [ "$i" -lt "$count" ]; do
    i=$((i + 1))
    curl -s --max-time 60 --cert "$work/certs/client.crt" --key "$work/certs/client.key" -k \
      --resolve "$host:$https_port:127.0.0.1" -o /dev/null -w '%{http_code}\n' \
      "$@" "https://$host:$https_port$path" > "$work/burst/$i" &
  done
}

answered() {
  grep -l "^$1\$" "$work/burst"/* 2>/dev/null | wc -l | tr -d ' '
}

check_between() {
  if [ "$2" -ge "$3" ] && [ "$2" -le "$4" ]; then
    echo "ok $1"
  else
    echo "not ok $1: got $2, want $3 to $4"
    failures=$((failures + 1))
  fi
}

header() {
  tr -d '\r' < "$work/headers" |
    awk -v name="$1" 'tolower($0) ~ "^" tolower(name) ":" { sub(/^[^:]*: */, ""); print; exit }'
}

body() {
  cat "$work/body" 2>/dev/null || true
}

check() {
  if [ "$2" = "$3" ]; then
    echo "ok $1"
  else
    echo "not ok $1: got '$2', want '$3'"
    failures=$((failures + 1))
  fi
}

check_contains() {
  case "$2" in
    *"$3"*) echo "ok $1" ;;
    *)
      echo "not ok $1: '$3' not in '$(printf '%s' "$2" | head -c 200)'"
      failures=$((failures + 1))
      ;;
  esac
}

finish() {
  if [ "$failures" -gt 0 ]; then
    echo "$failures failed"
    exit 1
  fi
}
