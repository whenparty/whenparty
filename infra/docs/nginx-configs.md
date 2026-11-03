# Working on the nginx configs

`docker-compose.yml` mounts `nginx/conf.d/` over the image's `/etc/nginx/conf.d/`, and the image's main config loads every `*.conf` file there into its `http` block. So the directives outside a `server` block apply to every site.

`default.conf` holds the shared settings, the port 80 server and the default server of port 443. `www.conf` and `nii-au.conf` hold one site each, `temp-sites.conf` the temporary sites, and `games.conf` the games and their signaling server, as [sites.md](sites.md) describes. `cloudflare_real_ip.conf` is generated on the VPS and ignored by git, as [cloudflare-ip-list.md](cloudflare-ip-list.md) says.

## Shared settings and a site's own

- A site config adds only what differs: its certificates, its Content-Security-Policy, its upstream and, when it needs other limits, its rate limits.
- `add_header_inherit merge` adds the `add_header` lines of a server, such as its Content-Security-Policy, to the shared headers instead of replacing them. It needs nginx 1.29.3 or later, so the image in `docker-compose.yml` stays at that version or above.
- `limit_conn` and `limit_req` in a server replace the shared limits instead of adding to them, as the `signaling.when.party` server does.
- An empty `Connection` header, which `$connection_upgrade` sends for every request that is not a WebSocket upgrade, keeps the keepalive connections to the upstreams usable.
- nginx picks a server with an exact `server_name` before one with a wildcard. So `www.when.party` and `when.party` have servers with their exact names in `www.conf`, the game hosts and `signaling.when.party` in `games.conf`, and every other `*.when.party` host falls to the wildcard server of `temp-sites.conf`. A `when.party` host that needs other settings than the temporary sites needs a server with its exact name.

## Games and signaling

- The server for the game hosts in `games.conf` names the host of every title in `games/`, and the server for `signaling.when.party` names the signaling server. [check-game-hosts.yml](/.github/workflows/check-game-hosts.yml) checks that the `server_name` entries of `games.conf`, across both servers, are exactly the `Host` labels of the deployments in `games/`, as [checks.md](/.github/docs/checks.md#the-checks) says. A game whose host is missing falls to the wildcard server, whose Content-Security-Policy blocks the signaling server.
- The Content-Security-Policy of the server for the game hosts lets the games reach the signaling server, over WebSocket and for their TURN credentials. A change to the policy of the temporary sites does not need the same change here. Both policies allow the Cloudflare Web Analytics script that Cloudflare adds to every page. The script reports to `/cdn-cgi/rum` on the page's own host, which `'self'` covers.
- The signaling server has its own limits per client address, in zones of its own. Every player holds one WebSocket there, and the players of one party often share an address, such as one Wi-Fi or a mobile carrier's NAT, so the 15 connections that the other sites allow would shut the 16th player out. Its own zones also keep those sockets from using up the 15 connections that the game pages get. The signaling server limits what each socket does, keeps its heartbeat below `proxy_read_timeout`, and relies on these limits, as the [signaling documentation](/games/platform/signaling/AGENTS.md) says.
- The Content-Security-Policy of the server for the game hosts and the Permissions-Policy of `default.conf` are copied to `games/platform/p2p/src/dev-headers.ts` for local game development, with the local signaling server added, as the [p2p documentation](/games/platform/p2p/AGENTS.md) says.

How each config reaches its backend is in [sites.md](sites.md). [game-hosts.md](/docs/decisions/game-hosts.md) explains why the games keep their hosts and have a config of their own.

## The default server

The server in `default.conf` with `default_server` gets every TLS connection on port 443 whose SNI names no server, or that has no SNI, and refuses the handshake, so the client gets no certificate. Cloudflare answers a proxied host that no config names with error 525. A second `default_server` on port 443 fails `nginx -t`. [default-server.md](decisions/default-server.md) explains the choice and which hosts reach this server.

## Checking a change

[check-nginx.yml](/.github/workflows/check-nginx.yml) runs `nginx -t` on `nginx/conf.d/` with the image from `docker-compose.yml`. `ci.yml` runs it for every change to `infra/`, and `infra.yml` runs it before every deploy. [checks.md](/.github/docs/checks.md#the-checks) says what it needs when a config names another certificate.

To run the same check locally from the repository root, put self-signed `nii.au.crt`, `nii.au.key`, `when.party.crt` and `when.party.key` in a folder and run:

```bash
docker run --rm \
  -v "$PWD/infra/nginx/conf.d:/etc/nginx/conf.d:ro" \
  -v /path/to/test/certs:/etc/nginx/certs:ro \
  "$(docker compose -f infra/docker-compose.yml config --images)" nginx -t
```
