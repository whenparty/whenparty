# WhenParty Infrastructure

Everything that runs on the WhenParty VPS behind Cloudflare: the nginx proxy that terminates TLS, the `www.nii.au` site, and temporary sites on `*.when.party`.

```
Internet → Cloudflare → nginx (TLS, this repo) ─┬→ www container           (www.nii.au)
                                               └→ Traefik → project containers (*.when.party)
```

## Layout

Each part deploys only when its own files change. Markdown-only changes don't deploy anything.

| Path | Workflow | Deploys |
| --- | --- | --- |
| `docker-compose.yml`, `nginx/`, `scripts/` | `.github/workflows/deploy.yml` | nginx proxy and all nginx configs |
| `www/` | `.github/workflows/www.yml` | www image and container |
| `temp-sites/projects/` | `.github/workflows/temp-sites.yml` | changed temp projects only |
| `temp-sites/traefik/` | `.github/workflows/traefik.yml` | Traefik router |

`www/` and `temp-sites/` were separate repos (`whenparty/www`, `whenparty/temp-sites`, now archived) and were imported with full history.

## Nginx Configuration

All nginx configs live in `nginx/conf.d/` and ship together with the nginx deploy:

- `default.conf` holds the settings shared by every site: rate limits, Cloudflare real IP, security headers, proxy headers (including WebSocket), the Docker DNS resolver, plus the port 80 catch-all that redirects to HTTPS and serves `/health`.
- `www.conf` serves `www.nii.au` and redirects `nii.au` to it.
- `temp-sites.conf` terminates TLS for `*.when.party` and passes every request to Traefik.
- `cloudflare_real_ip.conf` is the Cloudflare IP allow list. It is generated on the VPS and not tracked in git (see below).

A site config only adds what differs: its certificate, its `Content-Security-Policy`, and its upstream. Shared headers still apply because `default.conf` sets `add_header_inherit merge` (nginx 1.29.3+). Upstreams use `resolve`, so nginx starts and reloads even when a backend container is down.

Before deploying, CI runs `nginx -t` on the whole `conf.d` with throwaway certificates, using the image from `docker-compose.yml`.

To add a site, add its config to `nginx/conf.d/` and attach the nginx container to the site's Docker network in `docker-compose.yml`.

## Temp Sites

- Each project lives in `temp-sites/projects/<name>/` with a `compose.yml` (Traefik labels pick the host name) and an optional `Dockerfile`.
- On push, `temp-sites.yml` builds and pushes the image to GHCR for every changed project only, then runs `docker compose up -d` for it on the VPS. A deleted project folder takes the project down.
- Traefik (`temp-sites/traefik/`) runs continuously on the `wp_tempsites` network, listens on port 8000 and discovers project containers through their labels.

See [temp-sites/README.md](temp-sites/README.md) for adding a project.

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
- DNS records point to the VPS and are proxied.

### GitHub Secrets

| Secret | Used by |
| --- | --- |
| `VPS_HOST`, `VPS_USER`, `VPS_DEPLOY_KEY` | all deploys (SSH) |
| `TRAEFIK_DASHBOARD_USER`, `TRAEFIK_DASHBOARD_PASSWORD` | `traefik.yml` |

The `infra` repo also needs **Write** access to the GHCR packages it pushes (`www`, and each temp project), under Package settings → Manage Actions access.

## Nginx Deploy

On a push that touches `docker-compose.yml`, `nginx/**`, `scripts/**` or the workflow, `deploy.yml`:

1. validates the config with `nginx -t`
2. copies `docker-compose.yml`, `nginx/conf.d` and `scripts` to `/opt/services/whenparty/infra/`
3. runs `docker compose pull` and `docker compose up -d`
4. generates `cloudflare_real_ip.conf` if it is missing or has no entries
5. runs `nginx -t` on the server and reloads nginx
6. installs the hourly cron job that refreshes the Cloudflare IP list

The copy never deletes files on the server. When you remove a config from `nginx/conf.d/`, delete it on the VPS too.

## Cloudflare Real IP Automation

`scripts/update-cloudflare-real-ip.sh` writes the latest Cloudflare ranges to `/opt/services/whenparty/infra/nginx/conf.d/cloudflare_real_ip.conf`. When the list changes it validates the config and reloads nginx. When it doesn't change, nothing happens.

Every deploy installs this cron line for the deploy user, replacing any older line that runs the script and keeping all other lines:

```
0 * * * * /opt/services/whenparty/infra/scripts/update-cloudflare-real-ip.sh >/tmp/update-cloudflare-real-ip.log 2>&1
```

Check it with `crontab -l`. The last run's output is in `/tmp/update-cloudflare-real-ip.log`.

## Local Testing

```bash
docker run --rm \
  -v "$PWD/nginx/conf.d:/etc/nginx/conf.d:ro" \
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
