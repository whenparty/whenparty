#!/bin/sh
. "$(dirname "$0")/proxy.sh"

echo_stub www
echo_stub nii-au
stub traefik-tempsites "server {
  listen 8000;
  location ~ missing { return 404 'stub 404'; }
  location / {
    if (\$host = nope.when.party) { return 418; }
    return 200 'traefik-tempsites \$host \$request_uri|';
  }
}"
proxy_start

check '3-1 when.party redirects' "$(request when.party '/a?b=1')" 301
check '3-1 when.party redirects to www.when.party' "$(header location)" 'https://www.when.party/a?b=1'
check '3-1 nii.au redirects' "$(request nii.au '/a?b=1')" 301
check '3-1 nii.au redirects to www.nii.au' "$(header location)" 'https://www.nii.au/a?b=1'
request www.when.party /a >/dev/null
check_contains '3-1 www.when.party goes to www' "$(body)" 'www www.when.party /a|'
request www.nii.au /a >/dev/null
check_contains '3-1 www.nii.au goes to nii-au' "$(body)" 'nii-au www.nii.au /a|'
request dtm-cleaning.when.party /a >/dev/null
check_contains '3-1 another host goes to the temporary sites' "$(body)" 'traefik-tempsites dtm-cleaning.when.party /a|'
request a.b.when.party /a >/dev/null
check_contains '3-1 a host two levels below goes to the temporary sites' "$(body)" 'traefik-tempsites a.b.when.party /a|'

for host in www.when.party www.nii.au dtm-cleaning.when.party; do
  check "3-2 a 404 of $host keeps its status" "$(request "$host" /missing)" 404
  check_contains "3-2 a 404 of $host shows the shared page" "$(body)" '<title>Page not found</title>'
  check_contains "3-2 the shared page links to the root of $host" "$(body)" 'href="/"'
  check "3-2 the proxy answers /_errors/404.css on $host" "$(request "$host" /_errors/404.css)" 200
  check_contains "3-2 /_errors/404.css on $host holds the styles" "$(body)" '--paper'
done

check '3-3 a 418 of the router answers 404' "$(request nope.when.party /)" 404
check_contains '3-3 a 418 of the router shows the page for unknown hosts' "$(body)" '<title>Site not found</title>'
check_contains '3-3 the page for unknown hosts links to www.when.party' "$(body)" 'href="https://www.when.party/"'

finish
