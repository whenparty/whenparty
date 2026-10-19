#!/bin/sh
# Starts this coturn in Docker, with turnserver.conf and start.sh as deployed, and checks it with
# coturn's own test client. With good credentials a client relays to a public peer and to another
# relayed client, and is refused private peers. Bad credentials get no allocation.
# From games/platform/turn: sh tests/smoke.sh
set -eu
cd "$(dirname "$0")/.."

image=$(awk '$1 == "image:" {print $2}' compose.yml)
name=turn-smoke-$$
server_ip=11.11.11.10
failures=0

# Addresses outside every denied range, so that two relayed clients may reach each other. The
# network is internal: nothing leaves the host, and detect-external-ip finds nothing.
docker network create --internal --subnet 11.11.11.0/24 "$name" >/dev/null
cleanup() {
  docker rm -f "$name" >/dev/null 2>&1 || true
  docker network rm "$name" >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker run -d --name "$name" --network "$name" --ip "$server_ip" \
  -e TURN_SECRET=smoke-test-secret \
  -v "$PWD/turnserver.conf:/etc/coturn/turnserver.conf:ro" \
  -v "$PWD/start.sh:/etc/coturn/start.sh:ro" \
  --read-only --tmpfs /tmp:size=1m,mode=1777 \
  --cap-drop ALL --cap-add NET_BIND_SERVICE --security-opt no-new-privileges:true \
  --entrypoint /bin/sh "$image" /etc/coturn/start.sh >/dev/null

# coturn starts once start.sh is done, and its lookup of the external address can wait for DNS
# timeouts on this internal network. Wait until it answers STUN.
ready=false
for _ in $(seq 1 30); do
  if docker run --rm --network "$name" --entrypoint turnutils_stunclient "$image" "$server_ip" >/dev/null 2>&1; then
    ready=true
    break
  fi
  sleep 1
done

if [ "$ready" != true ]; then
  echo 'FAILED: coturn did not answer STUN within 30 s'
  docker logs "$name" 2>&1 | tail -30
  exit 1
fi

# The client exits with 255 when it is refused, which some checks expect: only its output counts
client() {
  docker run --rm --network "$name" --entrypoint turnutils_uclient "$image" -v -l 100 "$@" "$server_ip" 2>&1 || true
}

check() {
  if echo "$2" | grep -q "$3"; then
    echo "ok: $1"
  else
    echo "FAILED: $1 (expected '$3')"
    echo "$2" | tail -5
    failures=$((failures + 1))
  fi
}

check_not() {
  if echo "$2" | grep -q "$3"; then
    echo "FAILED: $1 (did not expect '$3')"
    echo "$2" | tail -5
    failures=$((failures + 1))
  else
    echo "ok: $1"
  fi
}

public=$(client -n 5 -m 1 -W smoke-test-secret -e 1.1.1.1 -r 3480)
check 'allocates with good credentials' "$public" 'Received relay addr'
check_not 'relays to a public peer' "$public" 'error 403'

for peer in 10.0.0.1 172.17.0.1 192.168.1.1 100.64.0.1 169.254.169.254 127.0.0.1; do
  check "refuses the private peer $peer" "$(client -n 5 -m 1 -W smoke-test-secret -e "$peer" -r 3480)" 'error 403'
done

# With fewer messages the client keeps waiting after the last one
relayed=$(client -n 20 -m 2 -W smoke-test-secret -y)
check_not 'relays between two relayed clients' "$relayed" 'error 403'
check 'loses no packets between two relayed clients' "$relayed" 'Total lost packets 0 '

check 'refuses bad credentials' "$(client -n 5 -m 1 -W wrong-secret -e 1.1.1.1 -r 3480)" 'Cannot complete Allocation'

if docker exec "$name" ps -o args | grep turnserver | grep -q smoke-test-secret; then
  echo 'FAILED: the secret is in the process arguments'
  failures=$((failures + 1))
else
  echo 'ok: the secret is not in the process arguments'
fi

if [ "$failures" -gt 0 ]; then
  echo '--- coturn log'
  docker logs "$name" 2>&1 | tail -30
fi

exit "$failures"
