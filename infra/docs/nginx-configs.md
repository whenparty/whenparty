# Working on the nginx configs

`docker-compose.yml` mounts `nginx/conf.d/` over the image's `/etc/nginx/conf.d/`, and the image's main config loads every `*.conf` file there into its `http` block. So the directives outside a `server` block apply to every site.

Each config's first comment says what it serves. `cloudflare_real_ip.conf` is generated on the VPS and ignored by git, as [cloudflare-ip-list.md](cloudflare-ip-list.md) says.

## Shared settings and a site's own

- A site config adds only what differs: its certificates, its Content-Security-Policy, its upstream and, when it needs other limits, its rate limits.
- `add_header_inherit merge` needs nginx 1.29.3 or later, so the image in `docker-compose.yml` stays at that version or above.
- `limit_conn` and `limit_req` in a server replace the shared limits instead of adding to them, as the `signaling.when.party` server does.
- nginx picks a server with an exact `server_name` before one with a wildcard. So `www.when.party`, `when.party` and `signaling.when.party` keep their own servers, and every other `*.when.party` host falls to the wildcard server and Traefik. A `when.party` host that must not go to Traefik needs a server with its exact name.
- The Content-Security-Policy of the wildcard server applies to every temporary site and game.
- The headers of `default.conf` and `temp-sites.conf` are copied to `games/platform/p2p/src/dev-headers.ts` for local game development, as the [p2p documentation](/games/platform/p2p/AGENTS.md) says. The signaling server keeps its heartbeat below `proxy_read_timeout` and relies on its own limits, as the [signaling documentation](/games/platform/signaling/AGENTS.md) says.

How each config reaches its backend is in [sites.md](sites.md).

## Checking a change

[check-nginx.yml](/.github/workflows/check-nginx.yml) runs `nginx -t` on `nginx/conf.d/` with the image from `docker-compose.yml`. `ci.yml` runs it for every change to `infra/`, and `infra.yml` runs it before every deploy. [checks.md](/.github/docs/checks.md#the-checks) says what it needs when a config names another certificate.

To run the same check locally from the repository root, put self-signed `nii.au.crt`, `nii.au.key`, `when.party.crt` and `when.party.key` in a folder and run:

```bash
docker run --rm \
  -v "$PWD/infra/nginx/conf.d:/etc/nginx/conf.d:ro" \
  -v /path/to/test/certs:/etc/nginx/certs:ro \
  "$(docker compose -f infra/docker-compose.yml config --images)" nginx -t
```
