# WhenParty Website (www)

Static website service

## Architecture

This service is part of the WhenParty multi-repo infrastructure. See the architecture overview in the `whenparty/infra` repository (`PROJECT_OVERVIEW.md`) for full details.

### Deployment Flow

```
Push to main → GitHub Actions builds Docker image →
Push to GHCR → Deploy to VPS → Register with nginx proxy →
Reload nginx
```

### Network Architecture

```
Internet → Cloudflare (SSL termination) →
VPS nginx proxy (Origin cert, port 443) →
www container (wp_www network, internal only)
```

**Security**: The www container has NO exposed ports. All traffic must go through the nginx proxy with Cloudflare origin certificates.

## Files

- `Dockerfile` - Builds nginx:alpine container with static HTML
- `docker-compose.yml` - Production service definition (no exposed ports)
- `nginx-config.conf` - Service-specific nginx routing (copied to infra during deploy)
- `.github/workflows/build-and-deploy.yml` - CI/CD pipeline
- `html/` - Static website files

## Development

### Local Testing

To test locally with exposed ports, create a `docker-compose.override.yml`:

```yaml
services:
  www:
    ports:
      - "3000:80"
```

Then run:

```bash
docker compose up
```

Visit: http://localhost:3000

**IMPORTANT**: Never commit `docker-compose.override.yml` to the repository.

### Build Locally

```bash
docker build -t www:local .
docker run -p 3000:80 www:local
```

## Deployment

### Prerequisites

Ensure these GitHub secrets are configured:

- `VPS_HOST` - VPS IP address
- `VPS_USER` - Deployment user
- `VPS_DEPLOY_KEY` - SSH private key

**Note**: This assumes your GHCR packages are **public**. If private, add `GHCR_READ_TOKEN` secret and login step to workflow.

### Automatic Deployment

Push to `main` branch triggers automatic deployment:

1. Builds Docker image
2. Pushes to `ghcr.io/whenparty/www:latest`
3. Copies `docker-compose.yml` and `nginx-config.conf` to VPS
4. Deploys service at `/opt/services/whenparty/www`
5. Registers with nginx proxy (copies config to infra)
6. Validates and reloads nginx

### Manual Deployment

```bash
# Trigger workflow manually
gh workflow run build-and-deploy.yml
```

## Security Features

### Cloudflare IP Validation

nginx config only trusts `CF-Connecting-IP` header from Cloudflare's official IP ranges. This prevents IP spoofing.

### Modern Security Headers

- `Strict-Transport-Security` - Forces HTTPS for 1 year
- `Content-Security-Policy` - Restricts resource loading
- `Referrer-Policy` - Controls referrer information
- `Permissions-Policy` - Restricts browser features
- `X-Frame-Options` - Prevents clickjacking
- `X-Content-Type-Options` - Prevents MIME sniffing
- `X-Permitted-Cross-Domain-Policies` - Blocks cross-domain policy files
- `Cross-Origin-Embedder-Policy: credentialless` - Allows cross-origin resources without credentials (compatible with CDNs like Google Fonts)
- `Cross-Origin-Opener-Policy` - Isolates browsing context (prevents Spectre attacks)
- `Cross-Origin-Resource-Policy` - Protects against cross-origin reads

### Server Hardening

- `server_tokens off` - Hides nginx version from response headers

### Gzip Compression

Dockerfile enables and configures gzip compression:

- Uncomments `gzip on;` directive (if commented)
- Configures `gzip_vary`, `gzip_proxied`, and compression level
- Enables compression for HTML, CSS, JS, JSON, XML, fonts, and SVG
- Reduces bandwidth usage and improves page load times

### Health Checks

Container includes health check to verify nginx is serving content.

## Maintenance

### Update Cloudflare IP Ranges

The Cloudflare allow list lives in `/opt/services/whenparty/infra/nginx/conf.d/cloudflare_real_ip.conf` and is managed by the `infra/scripts/update-cloudflare-real-ip.sh` automation. Ensure that job is scheduled on the VPS so the proxy reloads with the latest ranges—no manual edits to `nginx-config.conf` are required.

### Update Content

1. Edit files in `html/` directory
2. Commit and push to `main`
3. GitHub Actions automatically rebuilds and deploys

## Troubleshooting

### Check container status

```bash
ssh user@VPS_IP
cd /opt/services/whenparty/www
docker compose ps
docker compose logs
```

### Check nginx config

```bash
docker exec nginx nginx -t
docker exec nginx cat /etc/nginx/conf.d/www.conf
```

### Manually reload nginx

```bash
docker exec nginx nginx -s reload
```

### View logs

```bash
docker compose logs -f www
```
