#!/bin/sh
. "$(dirname "$0")/proxy.sh"

echo_stub www
echo_stub nii-au
echo_stub index
echo_stub signaling 8080
pause_stub traefik-tempsites 8000
proxy_start

headers='Strict-Transport-Security|max-age=31536000; includeSubDomains; preload
X-Frame-Options|SAMEORIGIN
X-Content-Type-Options|nosniff
Referrer-Policy|strict-origin-when-cross-origin
X-Permitted-Cross-Domain-Policies|none
Permissions-Policy|geolocation=(), microphone=(), camera=()
Cross-Origin-Embedder-Policy|credentialless
Cross-Origin-Opener-Policy|same-origin
Cross-Origin-Resource-Policy|same-origin'
for response in 'www.when.party /' 'www.when.party /missing' 'when.party /'; do
  set -- $response
  request "$1" "$2" >/dev/null
  while IFS='|' read -r name value; do
    check "2-1 $name on $1$2" "$(header "$name")" "$value"
  done <<EOF
$headers
EOF
done

while IFS='|' read -r host policy; do
  request "$host" / >/dev/null
  check "2-2 the Content-Security-Policy of $host" "$(header content-security-policy)" "$policy"
done <<'EOF'
www.when.party|default-src 'self'; script-src 'self' https://static.cloudflareinsights.com; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self' https://static.cloudflareinsights.com; frame-ancestors 'self';
www.nii.au|default-src 'self'; script-src 'self' https://static.cloudflareinsights.com; style-src 'self'; img-src 'self'; media-src 'self' blob:; connect-src 'self' https://static.cloudflareinsights.com; frame-ancestors 'self';
games.when.party|default-src 'self'; img-src 'self' data:; script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline'; connect-src 'self' wss://signaling.when.party https://signaling.when.party; frame-ancestors 'none';
dtm-cleaning.when.party|default-src 'self'; img-src 'self' data:; script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline'; frame-ancestors 'none';
when.party|
nii.au|
signaling.when.party|
EOF

request www.when.party /a --http1.1 -H 'X-Forwarded-For: 198.51.100.1' -H 'Upgrade: websocket' -H 'Connection: Upgrade' >/dev/null
seen=$(body)
address=$(printf '%s' "$seen" | cut -d '|' -f 2)
check_contains '2-3 the site gets the Host' "$seen" 'www www.when.party /a|'
check '2-3 the site gets the client address in X-Real-IP' "$(test -n "$address" && echo set)" set
check '2-3 the client address is appended to X-Forwarded-For' "$(printf '%s' "$seen" | cut -d '|' -f 3)" "198.51.100.1, $address"
check '2-3 the site gets X-Forwarded-Proto: https' "$(printf '%s' "$seen" | cut -d '|' -f 4)" https
check '2-3 a WebSocket upgrade keeps its Upgrade header' "$(printf '%s' "$seen" | cut -d '|' -f 5)" websocket
check '2-3 a WebSocket upgrade gets Connection: upgrade' "$(printf '%s' "$seen" | cut -d '|' -f 6)" upgrade

head -c 1048576 /dev/zero > "$work/largest.bin"
head -c 1048577 /dev/zero > "$work/too-large.bin"
check '2-6 a body of 1 MiB reaches the site' "$(request www.when.party / --data-binary "@$work/largest.bin")" 200
check '2-6 a body larger than 1 MiB answers 413' "$(request www.when.party / --data-binary "@$work/too-large.bin")" 413
check_contains '2-6 a body larger than 1 MiB does not reach the site' "$(body)" '<center>nginx</center>'

check '2-5 the configs close a request after 90 seconds of silence, on every host' \
  "$(grep -rh 'proxy_read_timeout' "$repo/infra/nginx/conf.d" | tr -s ' ')" 'proxy_read_timeout 90s;'
proxy_set_read_timeout 1s
check '2-5 a site that answers within the time keeps the request' "$(request dtm-cleaning.when.party /quick)" 200
check '2-5 a site that keeps sending keeps the request open past the time' "$(request dtm-cleaning.when.party /stream)" 200
check '2-5 a site that keeps sending gets its whole response through' "$(body)" xxxxxxx
check '2-5 a site silent before its response answers 504' "$(request dtm-cleaning.when.party /silent)" 504
check '2-5 a site silent after its response started keeps its status' "$(request dtm-cleaning.when.party /stalled)" 200
check '2-5 a site silent after its response started is closed before it sends more' "$(body | grep -c y || true)" 0
check '2-5 a WebSocket stays open while its site sends' "$(websocket dtm-cleaning.when.party /ws/site 0 1.8)" sssssss
check '2-5 a WebSocket stays open while its client sends' "$(websocket dtm-cleaning.when.party /ws/client 7 0.4)" done
check '2-5 a silent WebSocket is closed' "$(websocket dtm-cleaning.when.party /ws/silent 0 1.8)" ''
proxy_set_read_timeout 90s

burst_start 15 www.when.party /slow
sleep 1
check '2-4 the 16th request in progress, on any other host, answers 503' "$(request www.nii.au /)" 503
wait
check '2-4 15 requests in progress are answered' "$(answered 200)" 15
burst_start 64 signaling.when.party /slow
sleep 1
check '2-4 the 65th request in progress on signaling.when.party answers 503' "$(request signaling.when.party /)" 503
wait
check '2-4 64 requests in progress on signaling.when.party are answered' "$(answered 200)" 64

burst 30 www.when.party /
first=$(answered 200)
burst 30 www.nii.au /
check_between '2-4 the other hosts answer 31 requests at once, together' "$((first + $(answered 200)))" 31 45
burst 140 signaling.when.party /
check_between '2-4 signaling.when.party answers 101 requests at once, on its own' "$(answered 200)" 101 115

finish
