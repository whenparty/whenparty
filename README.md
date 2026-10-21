# WhenParty

Everything that runs on the WhenParty VPS behind Cloudflare: the nginx proxy that terminates TLS, the When Party site on `www.when.party`, the `www.nii.au` site, temporary sites on `*.when.party`, and the peer-to-peer games on `*.when.party`.

```
Internet → Cloudflare → nginx (TLS, this repo) ─┬→ www container   (www.when.party)
                                               ├→ nii-au container (www.nii.au)
                                               └→ Traefik → temp site and game containers (*.when.party)
```

## Layout

Each part deploys only when its own files change. Markdown-only changes don't deploy anything.

| Path | Workflow | Deploys |
| --- | --- | --- |
| `infra/` | `.github/workflows/infra.yml` | nginx proxy (`docker-compose.yml`), all nginx configs (`nginx/conf.d/`) and scripts |
| `www/` | `.github/workflows/www.yml` | When Party site (`www` image and container) |
| `nii-au/` | `.github/workflows/nii-au.yml` | nii.au site (`nii-au` image and container) |
| `temp-sites/projects/` | `.github/workflows/temp-sites.yml` | changed temp projects only |
| `temp-sites/traefik/` | `.github/workflows/traefik.yml` | Traefik router |
| `games/` | `.github/workflows/games.yml` | changed games and game services only (signaling server) |

`www.yml` and `nii-au.yml` both call `.github/workflows/site.yml`: build the folder's `Dockerfile`, stop on critical Trivy findings, push `ghcr.io/whenparty/<folder>:latest`, then run the folder's `docker-compose.yml` in `/opt/services/whenparty/<folder>`. A change to `site.yml` redeploys both sites.

`temp-sites.yml` and `games.yml` find the changed projects and call `.github/workflows/deploy-project.yml` for each one: build and push its image (`latest` + `sha-<commit>`), copy the project folder to the same path under `/opt/services/whenparty/` and run its `compose.yml`, or take it down when the folder is gone.

`.github/workflows/image-scan.yml` runs every Monday (or manually) and scans every image the VPS runs with Trivy. That includes the nginx proxy and Traefik, which no deploy scans. It reads the image list from the compose files, uploads the results to GitHub Security, and turns red on a critical finding. That means the image needs a bump.

Every third-party action is pinned to a full commit SHA, with its version in a comment (`uses: owner/action@<sha> # v1.2.3`). A tag can be moved to different code, but a SHA can't. This matters because the deploy jobs hold the VPS SSH key. To update an action, look up the commit of the new release tag and replace both the SHA and the comment.

`temp-sites/` and the nii.au site (then in `www/`) were separate repos (`whenparty/temp-sites`, `whenparty/www`, now archived) and were imported with full history. This repo itself was named `whenparty/infra` until October 2026, and GitHub redirects the old name.

## Nginx Configuration

All nginx configs live in `infra/nginx/conf.d/` and ship together with the nginx deploy:

- `default.conf` holds the settings shared by every site: rate limits, Cloudflare real IP, security headers, proxy headers (including WebSocket), the Docker DNS resolver, plus the port 80 catch-all that redirects to HTTPS and serves `/health`.
- `www.conf` serves `www.when.party` and redirects `when.party` to it. These exact names win over the wildcard in `temp-sites.conf`.
- `nii-au.conf` serves `www.nii.au` and redirects `nii.au` to it.
- `temp-sites.conf` terminates TLS for every other `*.when.party` host and passes the request to Traefik. Its CSP also allows `wss://signaling.when.party` and `https://signaling.when.party`, the Trystero signaling server for peer-to-peer games (`games/platform/signaling/`), which also hands out TURN credentials.
- `cloudflare_real_ip.conf` is the Cloudflare IP allow list. It is generated on the VPS and not tracked in git (see below).
- `cloudflare-origin-pull-ca.pem` is Cloudflare's public Authenticated Origin Pulls CA (valid until 2029-11-01). With `ssl_verify_client on` in `default.conf`, port 443 accepts only connections that present Cloudflare's client certificate, so nobody can bypass Cloudflare by hitting the server IP directly (they get a 400). Port 80 (redirects and `/health`) is unaffected.

A site config only adds what differs: its certificate, its `Content-Security-Policy`, and its upstream. Shared headers still apply because `default.conf` sets `add_header_inherit merge` (nginx 1.29.3+). Upstreams use `resolve`, so nginx starts and reloads even when a backend container is down.

Before deploying, CI runs `nginx -t` on the whole `conf.d` with throwaway certificates, using the image from `infra/docker-compose.yml`.

To add a site, add its config to `infra/nginx/conf.d/` and attach the nginx container to the site's Docker network in `infra/docker-compose.yml`.

## Temp Sites

- Each project lives in `temp-sites/projects/<name>/` with a `compose.yml` (Traefik labels pick the host name) and an optional `Dockerfile`.
- On push, `temp-sites.yml` builds and pushes the image to GHCR for every changed project only, then runs `docker compose up -d` for it on the VPS. A deleted project folder takes the project down.
- Traefik (`temp-sites/traefik/`) runs continuously on the `wp_tempsites` network, listens on port 8000 and discovers project containers through their labels.

See [temp-sites/README.md](temp-sites/README.md) for adding a project.

## Games

- Peer-to-peer browser games: players find each other by a room code, and the game state goes directly between their browsers over WebRTC. Nothing about a game is stored on the server.
- `games/` is one npm workspace. `games/platform/` holds what the games share, such as the `signaling` server at `signaling.when.party`. `games/titles/<name>/` holds one game each.
- On push, `games.yml` tests the whole workspace, then deploys only the projects a change reaches. A change in a shared platform library redeploys every title.
- Games run behind the temp-sites Traefik router and the `*.when.party` nginx config, so they get the same CSP as temp sites.

See [games/AGENTS.md](games/AGENTS.md).

## Prerequisites

### VPS

```bash
mkdir -p /opt/services/whenparty/infra/nginx/certs
```

The deploys create the `wp_www` and `wp_tempsites` Docker networks when they are missing.

### Certificates

Cloudflare Origin Certificates (15-year validity), created in Cloudflare Dashboard → SSL/TLS → Origin Server:

| Files in `/opt/services/whenparty/infra/nginx/certs/` | Hostnames |
| --- | --- |
| `nii.au.crt`, `nii.au.key` | `nii.au`, `*.nii.au` |
| `when.party.crt`, `when.party.key` | `when.party`, `*.when.party` |

```bash
chmod 644 /opt/services/whenparty/infra/nginx/certs/*.crt
chmod 600 /opt/services/whenparty/infra/nginx/certs/*.key
```

### Cloudflare

- SSL/TLS mode: **Full (strict)**
- Always Use HTTPS: on
- SSL/TLS → Origin Server → **Authenticated Origin Pulls: on**, in every zone served here (`nii.au`, `when.party`). Without it, nginx rejects Cloudflare's requests and the sites in that zone return 400.
- DNS records for the sites point to the VPS and are proxied.

### GitHub Secrets

| Secret | Used by |
| --- | --- |
| `VPS_HOST`, `VPS_USER`, `VPS_DEPLOY_KEY` | all deploys (SSH) |
| `TRAEFIK_DASHBOARD_USER`, `TRAEFIK_DASHBOARD_PASSWORD` | `traefik.yml` |

This repo (`whenparty/whenparty`) also needs **Write** access to the GHCR packages it pushes (`www`, `nii-au`, and each temp project), under Package settings → Manage Actions access. A package first pushed from this repo gets that access automatically. The VPS pulls without logging in, so every package must be **public**.

## Nginx Deploy

On a push that touches `infra/**` (Markdown excluded) or the workflow, `infra.yml`:

1. validates the config with `nginx -t`
2. copies `infra/` (`docker-compose.yml`, `nginx/conf.d`, `scripts`) to `/opt/services/whenparty/infra/`, the same layout
3. runs `docker compose pull` and `docker compose up -d`
4. generates `cloudflare_real_ip.conf` if it is missing or has no entries
5. runs `nginx -t` on the server and reloads nginx
6. installs the hourly cron job that refreshes the Cloudflare IP list

The copy never deletes files on the server. When you remove a config from `infra/nginx/conf.d/`, delete it on the VPS too.

## Cloudflare Real IP Automation

`infra/scripts/update-cloudflare-real-ip.sh` writes the latest Cloudflare ranges to `/opt/services/whenparty/infra/nginx/conf.d/cloudflare_real_ip.conf`. When the list changes it validates the config and reloads nginx. When it doesn't change, nothing happens.

Every deploy installs this cron line for the deploy user, replacing any older line that runs the script and keeping all other lines:

```
0 * * * * /opt/services/whenparty/infra/scripts/update-cloudflare-real-ip.sh >/tmp/update-cloudflare-real-ip.log 2>&1
```

Check it with `crontab -l`. The last run's output is in `/tmp/update-cloudflare-real-ip.log`.

## Local Testing

```bash
docker run --rm \
  -v "$PWD/infra/nginx/conf.d:/etc/nginx/conf.d:ro" \
  -v /path/to/test/certs:/etc/nginx/certs:ro \
  nginx:1.31.7-alpine nginx -t
```

The test certs folder needs `nii.au.*` and `when.party.*` files. Self-signed ones work.

## Troubleshooting

```bash
# nginx config and logs
docker exec nginx nginx -t
docker compose logs nginx

# container health (the healthcheck calls http://127.0.0.1/health)
docker inspect -f '{{.State.Health.Status}}' nginx

# a site returns 502: is its backend running and on the right network?
docker network inspect wp_www
docker network inspect wp_tempsites
```

## See Also

- [Cloudflare Origin Certificates](https://developers.cloudflare.com/ssl/origin-configuration/origin-ca/)
