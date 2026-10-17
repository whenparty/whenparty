# WhenParty Infrastructure

Nginx reverse proxy infrastructure for the WhenParty project using Cloudflare Origin Certificates.

## Monorepo Layout

This repo now also holds the former `whenparty/www` and `whenparty/temp-sites` repos, imported with full history. Each part deploys only when its own files change:

| Path | Workflow | Deploys |
| --- | --- | --- |
| `docker-compose.yml`, `nginx/`, `scripts/` | `.github/workflows/deploy.yml` | nginx proxy |
| `www/` | `.github/workflows/www.yml` | www image and container |
| `temp-sites/projects/`, `temp-sites/nginx-config/` | `.github/workflows/temp-sites.yml` | changed temp projects and the wildcard nginx config |
| `temp-sites/traefik/` | `.github/workflows/traefik.yml` | Traefik router |

Markdown-only changes don't deploy anything. The sections below still describe the multi-repo deploy mechanics, which stay in place until the nginx configs are consolidated.

## Architecture

- **Purpose**: Nginx reverse proxy only (no application services)
- **Networks**: Docker networks `wp_www` (www service) and `wp_tempsites` (temp-site router); additional services (e.g. Telegram bot) should provision their own `wp_*` network
- **Temp Sites Router**: The `whenparty-temp-sites` repo owns the wildcard `*.when.party` nginx config and Traefik router on `wp_tempsites`, syncing changes back into this stack during its deploy workflow
- **TLS**: Cloudflare Origin Certificates with 15-year validity
- **Deployment**: Automated via GitHub Actions

## Prerequisites

### 1. VPS Setup

```bash
# Create Docker networks (run once)
docker network create wp_www
docker network create wp_tempsites

# Create deployment directory
mkdir -p /opt/services/whenparty/infra/nginx/certs
```

### 2. Install Certificates

You must manually install Cloudflare Origin Certificates on the VPS:

1. Generate certificate in Cloudflare Dashboard → SSL/TLS → Origin Server
   - Hostnames: `example.com`, `*.example.com`, `*.temp.example.com`
   - Validity: 15 years
2. Copy certificate and key to VPS:
   ```bash
   # On VPS (replace example.com with your domain)
   nano /opt/services/whenparty/infra/nginx/certs/example.com.crt  # Paste certificate
   nano /opt/services/whenparty/infra/nginx/certs/example.com.key  # Paste private key
   chmod 600 /opt/services/whenparty/infra/nginx/certs/example.com.key
   chmod 644 /opt/services/whenparty/infra/nginx/certs/example.com.crt
   ```

### 3. Cloudflare Settings

```yaml
SSL/TLS:
  Mode: Full (strict) # Critical!
  Edge Certificates:
    Always Use HTTPS: ON

DNS: A    @         YOUR_VPS_IP    Proxied
  A    www       YOUR_VPS_IP    Proxied
```

### 4. GitHub Secrets

Configure these secrets in your GitHub repository:

```yaml
VPS_HOST: your.vps.ip.address
VPS_USER: your-deploy-user
VPS_DEPLOY_KEY: |
  -----BEGIN OPENSSH PRIVATE KEY-----
  [SSH private key for deployment]
  -----END OPENSSH PRIVATE KEY-----
```

## Local Development

Test the nginx configuration locally:

```bash
# Start services
docker compose up -d

# Check logs
docker compose logs -f

# Test health endpoint
curl http://localhost/health

# Reload nginx after config changes
docker exec nginx nginx -s reload
```

## Deployment

Deployment is automated via GitHub Actions:

- **Trigger**: Push to `main` branch with changes to `docker-compose.yml`, `nginx/**`, `scripts/**` or the workflow itself
- **Process**:
  1. Copies `docker-compose.yml`, `nginx/conf.d` and `scripts` to VPS
  2. Runs `docker compose up -d` to update containers
  3. Generates `cloudflare_real_ip.conf` if it is missing or still a placeholder
  4. Reloads nginx configuration
  5. Installs the hourly cron job that refreshes `cloudflare_real_ip.conf`

## Network Architecture

This infrastructure is part of a multi-repository architecture:

``` 
 whenparty-infra/          # This repo - Nginx proxy only
 whenparty-www/            # Main website (connects to wp_www)
 whenparty-telegram-bot/   # Telegram bot + PostgreSQL (connects to wp_tg_bot)
 whenparty-temp-sites/     # Temp projects + Traefik router + wildcard nginx config (wp_tempsites)
```

`whenparty-temp-sites` now carries the Traefik router, wildcard nginx config, and project directories. Its deploy workflow copies `nginx-config/temp-sites.conf` into `/opt/services/whenparty/infra/nginx/conf.d/temp-sites.conf`, ensures the `traefik-tempsites` container is running on `wp_tempsites`, validates nginx, and reloads the proxy after every push.

Each service provisions its own external Docker network (`wp_*`). nginx—and any shared infrastructure like monitoring—only joins the networks it must reach (`wp_www`, `wp_tempsites`, future `wp_tg_bot`, etc.), preserving isolation between application containers.

## Temp Sites Router

- `nginx/conf.d/temp-sites.conf` lives in the `whenparty-temp-sites` repo (`nginx-config/temp-sites.conf`). It terminates TLS for `*.when.party` using the Cloudflare Origin certificate and proxies every request to `http://traefik-tempsites:8000` on `wp_tempsites`.
- `traefik-tempsites` is defined in `whenparty-temp-sites/traefik/docker-compose.yml`. The container runs continuously, listens on port 8000, exposes the dashboard at `traefik.when.party`, and discovers project containers through Traefik labels.
- Temp projects under `whenparty-temp-sites/projects/<name>` ship a `compose.yml` (and optional `Dockerfile`). The GitHub Actions workflow builds/pushes images if needed, ensures `wp_tempsites` exists, runs `docker compose up -d --remove-orphans` in each changed project directory on the VPS, and prunes old images.
- After each deploy, the workflow copies the wildcard config mentioned above, runs `nginx -t`, reloads nginx, and relies on this repo's `scripts/update-cloudflare-real-ip.sh` to keep `/opt/services/whenparty/infra/nginx/conf.d/cloudflare_real_ip.conf` current.

Traffic for temp sites flows `Internet → Cloudflare → nginx (TLS) → Traefik → project container`, keeping nginx slim while Traefik handles per-host routing for disposable apps.

## Nginx Configuration

### Architecture

This infrastructure uses a **service-owned configuration** pattern:

- **Core infrastructure configs** (`nginx/conf.d/default.conf`) - maintained in this repo:

  - HTTP to HTTPS redirection
  - Health check endpoint at `/health`

- **Shared includes** (referenced by service configs):

  - `nginx/conf.d/includes/security-headers.conf` — baseline response headers
  - `nginx/conf.d/cloudflare_real_ip.conf` — Cloudflare IP allow list, generated on the VPS by `scripts/update-cloudflare-real-ip.sh` (not tracked in git)

- **Service-specific configs** - maintained in service repos:
  - Each service maintains its own nginx config with all its routing rules
  - Example: `whenparty-www` owns both `www.example.com` and apex redirect (`example.com` → `www.example.com`)
  - During deployment, services copy their config to `nginx/conf.d/`
  - Example: `www.conf` is copied from `whenparty-www` during its deployment
- **Temp sites wildcard config** - maintained in `whenparty-temp-sites/nginx-config/temp-sites.conf`. It is copied into `/opt/services/whenparty/infra/nginx/conf.d/` by the temp-sites deploy workflow and proxies `*.when.party` to Traefik.

### Service Deployment Pattern

When a service deploys, it follows this pattern:

```bash
# In service repo's .github/workflows/deploy.yml
steps:
  - name: Deploy service and update nginx
    run: |
      # Deploy service
      cd /opt/services/whenparty/www
      docker compose pull
      docker compose up -d

      # Copy nginx config to infra
      cp nginx-config.conf /opt/services/whenparty/infra/nginx/conf.d/www.conf

      # Validate and reload nginx
      docker exec nginx nginx -t && docker exec nginx nginx -s reload
```

This pattern allows:

- Services to own their routing configuration
- Independent service deployments
- Automatic nginx configuration updates
- Clear separation of concerns

`whenparty-temp-sites` follows the same validation/reload steps but instead of writing per-project configs it keeps the shared `temp-sites.conf` in sync and offloads host routing to the long-running `traefik-tempsites` container.

### Temp Sites Wildcard Config

The `temp-sites.conf` file shipped in `whenparty-temp-sites/nginx-config/` defines a wildcard `server_name *.when.party`, pulls in the shared security headers and real-IP include from this repo, and proxies all requests to `http://traefik-tempsites:8000`. The deploy workflow for temp sites copies that file into `/opt/services/whenparty/infra/nginx/conf.d/`, runs `nginx -t`, and reloads the proxy. If traffic breaks, verify that:

1. `/opt/services/whenparty/infra/nginx/conf.d/temp-sites.conf` matches the latest commit in `whenparty-temp-sites`.
2. The `traefik-tempsites` container (defined in `whenparty-temp-sites/traefik/docker-compose.yml`) is healthy and attached to `wp_tempsites`.
3. `scripts/update-cloudflare-real-ip.sh` is in the deploy user's crontab (`crontab -l`) so the Cloudflare allow list stays fresh for both `default.conf` and `temp-sites.conf`.

### Service Decommissioning

When removing a service:

1. Stop and remove the service container
2. Remove the service's nginx config:
   ```bash
   rm /opt/services/whenparty/infra/nginx/conf.d/service-name.conf
   docker exec nginx nginx -s reload
   ```
3. Each service is responsible for cleaning up its own nginx configuration

**Note**: The infra repo does not automatically remove service configs to avoid accidentally breaking running services.

## Cloudflare Real IP Automation

Use `scripts/update-cloudflare-real-ip.sh` to refresh `/opt/services/whenparty/infra/nginx/conf.d/cloudflare_real_ip.conf` with the latest ranges from Cloudflare:

```bash
/opt/services/whenparty/infra/scripts/update-cloudflare-real-ip.sh
```

When the allow list changes the script validates the nginx configuration and reloads the proxy automatically.

The file is not tracked in git, so infra deploys never overwrite it. The deploy workflow only runs the script when the file is missing or has no `set_real_ip_from` entries (e.g. on a fresh VPS).

### Cron

Every deploy installs an hourly cron job for the deploy user, so the allow list stays current and nginx reloads when the ranges change:

```
0 * * * * /opt/services/whenparty/infra/scripts/update-cloudflare-real-ip.sh >/tmp/update-cloudflare-real-ip.log 2>&1
```

The deploy replaces any existing crontab line that runs this script (whatever its schedule or log path) with the line above and keeps all other lines. Check it with `crontab -l`; the last run's output is in `/tmp/update-cloudflare-real-ip.log`.

To install it by hand (e.g. before the first deploy), run `crontab -e` as the deploy user and add the same line.

## Troubleshooting

### Nginx won't start

```bash
# Check nginx config syntax
docker exec nginx nginx -t

# Check logs
docker compose logs nginx
```

### Certificate errors

Ensure certificates exist and have correct permissions:

```bash
ls -la /opt/services/whenparty/infra/nginx/certs/
# Should see example.com.crt (644) and example.com.key (600)
```

### Backend connection errors

Ensure the `www` service is running and connected to `wp_www`:

```bash
docker network inspect wp_www
```

## Key Benefits

- **Simple**: No certificate renewal, no ACME complexity
- **Secure**: Only Cloudflare can reach your VPS
- **Fast**: Cloudflare CDN and DDoS protection
- **Scalable**: Easy to add new services to dedicated `wp_*` networks
- **Automated**: Push to deploy via GitHub Actions

## See Also

- [PROJECT_OVERVIEW.md](./PROJECT_OVERVIEW.md) - Complete architecture documentation
- [Cloudflare Origin Certificates](https://developers.cloudflare.com/ssl/origin-configuration/origin-ca/)
