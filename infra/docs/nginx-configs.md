# Working on the nginx configs

`docker-compose.yml` mounts `nginx/conf.d/` over the image's `/etc/nginx/conf.d/`, and the image's main config loads every `*.conf` file there into its `http` block. So the directives outside a `server` block apply to every site.

`default.conf` holds the shared settings, the port 80 server and the default server of port 443. `www.conf` and `nii-au.conf` hold one site each, `temp-sites.conf` the temporary sites, and `games.conf` the games and their signaling server, as [sites.md](sites.md) describes and [games-conf.md](games-conf.md) details. `cloudflare_real_ip.conf` is generated on the VPS and ignored by git, as [cloudflare-ip-list.md](cloudflare-ip-list.md) says. `errors/` holds the 404 pages and `errors/pages.inc`, which serves the shared one. None of them matches `*.conf`, so nginx loads them only through an include or a location.

## Shared settings and a site's own

- A site config adds only what differs: its certificates, its Content-Security-Policy, its upstream, the include of `errors/pages.inc` unless it has a 404 page of its own, and, when it needs other limits, its rate limits.
- `add_header_inherit merge` adds the `add_header` lines of a server, such as its Content-Security-Policy, to the shared headers instead of replacing them. It needs nginx 1.29.3 or later, so the image in `docker-compose.yml` stays at that version or above.
- `limit_conn` and `limit_req` in a server replace the shared limits instead of adding to them, as the `signaling.when.party` server does.
- An empty `Connection` header, which `$connection_upgrade` sends for every request that is not a WebSocket upgrade, keeps the keepalive connections to the upstreams usable.
- A server that includes `errors/pages.inc` gets the shared 404 page `errors/404.html` and its styles at `/_errors/404.css`, which requirement `3-2` of [3-sites.md](specs/3-sites.md) describes. The page must load under the Content-Security-Policy of every server that includes it, so its styles stay in `errors/404.css` and it loads nothing inline or from another host. It links to `/` of the same host. The servers of `www.when.party`, `www.nii.au` and the temporary sites include it, so a new site gets it by including it too. A site with a 404 page of its own leaves out the include and sets its own `error_page`, as the server for the games in [games-conf.md](games-conf.md) does. A site that includes it serves nothing under `/_errors/`.
- For a request on a host of `temp-sites.conf` that no other Traefik router matches, the router `unknown-host` of [traefik.md](/temp-sites/docs/traefik.md) answers 418, and `temp-sites.conf` turns that into `errors/unknown-host.html` with status 404, as `3-3` says. That page links to `https://www.when.party/`, because the host has no home page of its own. It loads `/_errors/404.css`, so `temp-sites.conf` keeps the include of `errors/pages.inc`. A temporary site that itself answers 418, or misses a path of its own `PathPrefix` router, shows this page too.
- nginx picks a server with an exact `server_name` before one with a wildcard. So `www.when.party` and `when.party` have servers with their exact names in `www.conf`, `games.when.party` and `signaling.when.party` in `games.conf`, and every other `*.when.party` host falls to the wildcard server of `temp-sites.conf`. A `when.party` host that needs other settings than the temporary sites needs a server with its exact name.

## The default server

The server in `default.conf` with `default_server` gets every TLS connection on port 443 whose SNI names no server, or that has no SNI, and refuses the handshake, so the client gets no certificate, as `1-1` of [1-connections.md](specs/1-connections.md) says. Cloudflare answers a proxied host that no config names with error 525. A second `default_server` on port 443 fails `nginx -t`. [default-server.md](decisions/default-server.md) explains the choice and which hosts reach this server.

## The health check

The `healthcheck` in `docker-compose.yml` calls `/health` of the port 80 server at `127.0.0.1`, not `localhost`: BusyBox `wget` in the image resolves `localhost` to `::1`, and the port 80 server listens only on IPv4.

## Checking a change

[check-nginx.yml](/.github/workflows/check-nginx.yml) runs `nginx -t` on `nginx/conf.d/` with the image from `docker-compose.yml`, and then the smoke tests that [verification.md](verification.md) describes. `ci.yml` runs it for every change to `infra/`, and `infra.yml` runs it before every deploy. [checks.md](/.github/docs/checks.md#the-checks) says what it needs when a config names another certificate.

To run the same check locally from the repository root, put self-signed `nii.au.crt`, `nii.au.key`, `when.party.crt` and `when.party.key` in a folder and run:

```bash
docker run --rm \
  -v "$PWD/infra/nginx/conf.d:/etc/nginx/conf.d:ro" \
  -v /path/to/test/certs:/etc/nginx/certs:ro \
  "$(docker compose -f infra/docker-compose.yml config --images)" nginx -t
```
