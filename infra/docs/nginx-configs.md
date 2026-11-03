# Working on the nginx configs

`docker-compose.yml` mounts `nginx/conf.d/` over the image's `/etc/nginx/conf.d/`, and the image's main config loads every `*.conf` file there into its `http` block. So the directives outside a `server` block apply to every site.

`default.conf` holds the shared settings, the port 80 server and the default server of port 443. `www.conf` and `nii-au.conf` hold one site each, `temp-sites.conf` the temporary sites, and `games.conf` the games and their signaling server, as [sites.md](sites.md) describes and [games-conf.md](games-conf.md) details. `cloudflare_real_ip.conf` is generated on the VPS and ignored by git, as [cloudflare-ip-list.md](cloudflare-ip-list.md) says.

## Shared settings and a site's own

- A site config adds only what differs: its certificates, its Content-Security-Policy, its upstream and, when it needs other limits, its rate limits.
- `add_header_inherit merge` adds the `add_header` lines of a server, such as its Content-Security-Policy, to the shared headers instead of replacing them. It needs nginx 1.29.3 or later, so the image in `docker-compose.yml` stays at that version or above.
- `limit_conn` and `limit_req` in a server replace the shared limits instead of adding to them, as the `signaling.when.party` server does.
- An empty `Connection` header, which `$connection_upgrade` sends for every request that is not a WebSocket upgrade, keeps the keepalive connections to the upstreams usable.
- nginx picks a server with an exact `server_name` before one with a wildcard. So `www.when.party` and `when.party` have servers with their exact names in `www.conf`, `games.when.party`, the former hosts of the games and `signaling.when.party` in `games.conf`, and every other `*.when.party` host falls to the wildcard server of `temp-sites.conf`. A `when.party` host that needs other settings than the temporary sites needs a server with its exact name.

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
