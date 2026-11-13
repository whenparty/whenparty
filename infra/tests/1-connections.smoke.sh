#!/bin/sh
. "$(dirname "$0")/proxy.sh"

echo_stub www
proxy_start

certificate() {
  openssl s_client -connect "127.0.0.1:$https_port" -servername "$1" </dev/null 2>/dev/null |
    grep -c 'BEGIN CERTIFICATE' || true
}

check '1-1 a host of the sites completes the handshake' "$(request www.when.party /)" 200
check '1-1 a host of the sites gets a certificate' "$(certificate www.when.party)" 1
check '1-1 a host two levels below when.party completes the handshake' "$(request a.b.when.party /)" 502
check '1-1 another host gets no handshake' "$(request example.com /)" 000
check '1-1 another host gets no certificate' "$(certificate example.com)" 0
check '1-1 a host below nii.au gets no handshake' "$(request other.nii.au /)" 000
check '1-1 a connection without SNI gets no handshake' "$(request 127.0.0.1 /)" 000

client() {
  curl -s -k --resolve "www.when.party:$https_port:127.0.0.1" -o "$work/body" -w '%{http_code}' \
    "$@" "https://www.when.party:$https_port/" || true
}
check '1-2 a request without a client certificate answers 400' "$(client)" 400
check_contains '1-2 a request without a client certificate reaches no site' "$(body)" 'No required SSL certificate was sent'
check '1-2 a client certificate of another authority answers 400' \
  "$(client --cert "$work/certs/other-client.crt" --key "$work/certs/other-client.key")" 400

http() {
  curl -s -H "Host: $1" -o "$work/body" -D "$work/headers" -w '%{http_code}' \
    "http://127.0.0.1:$http_port$2" || true
}
check '1-3 port 80 redirects to https' "$(http www.when.party '/a/b?c=1')" 301
check '1-3 the redirect keeps the host, path and query' "$(header location)" 'https://www.when.party/a/b?c=1'
http games.when.party /tictactoe/ >/dev/null
check '1-3 any host redirects' "$(header location)" 'https://games.when.party/tictactoe/'
check '1-3 /health/ redirects' "$(http www.when.party /health/)" 301

check '1-4 /health answers 200' "$(http anything.example /health)" 200
check '1-4 /health answers OK' "$(body)" OK

real_ip() {
  request www.when.party / -H "CF-Connecting-IP: $1" >/dev/null
  body | cut -d '|' -f 2
}
direct=$(real_ip 203.0.113.7)
check '1-5 a request from outside the Cloudflare ranges keeps its address' \
  "$(test -n "$direct" && test "$direct" != 203.0.113.7 && echo kept)" kept
proxy_set_real_ip 'set_real_ip_from 0.0.0.0/0;'
check '1-5 a request from a Cloudflare range comes from CF-Connecting-IP' "$(real_ip 203.0.113.7)" 203.0.113.7

burst 20 www.when.party / -H 'CF-Connecting-IP: 203.0.113.10'
first=$(answered 200)
burst 20 www.when.party / -H 'CF-Connecting-IP: 203.0.113.11'
check '1-5 the limits count each client address on its own' "$((first + $(answered 200)))" 40
burst 40 www.when.party / -H 'CF-Connecting-IP: 203.0.113.12'
check_between '1-5 the same requests from one client address reach a limit' "$(answered 200)" 1 39

finish
