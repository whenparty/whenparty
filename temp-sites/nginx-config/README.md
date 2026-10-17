# Nginx Configuration for Temp Sites

This directory contains the nginx configuration that should be deployed to the infrastructure repository.

## Deployment Instructions

### One-Time Setup

1. **Generate Cloudflare Origin Certificate** (if not already done):

   - Go to Cloudflare Dashboard → SSL/TLS → Origin Server
   - Click "Create Certificate"
   - Add hostnames: `*.when.party`, `when.party`
   - Choose 15 years validity
   - Copy the certificate and private key

2. **Install certificate on VPS**:

   ```bash
   ssh user@your-vps

   # Create certificate files
   sudo nano /opt/services/whenparty/infra/nginx/certs/when.party.crt
   # Paste the certificate

   sudo nano /opt/services/whenparty/infra/nginx/certs/when.party.key
   # Paste the private key

   # Set permissions
   sudo chmod 644 /opt/services/whenparty/infra/nginx/certs/when.party.crt
   sudo chmod 600 /opt/services/whenparty/infra/nginx/certs/when.party.key
   sudo chown -R user:group /opt/services/whenparty/infra/nginx/certs/
   ```

3. **Bootstrap nginx config**: the deploy workflow copies `nginx-config/temp-sites.conf` to `/opt/services/whenparty/infra/nginx/conf.d/` on every push. For the very first deployment you can either trigger the workflow or copy the file manually:

   **Option A: Manual copy**

   ```bash
   # On your local machine
   cp nginx-config/temp-sites.conf /path/to/whenparty-infra/nginx/conf.d/

   # Push to infra repo
   cd /path/to/whenparty-infra
   git add nginx/conf.d/temp-sites.conf
   git commit -m "Add temp sites wildcard nginx config"
   git push origin main
   ```

   **Option B: SSH to VPS**

   ```bash
   ssh user@your-vps

   # Copy the config directly
   sudo nano /opt/services/whenparty/infra/nginx/conf.d/temp-sites.conf
   # Paste the contents of temp-sites.conf

   # Test and reload nginx
   docker exec nginx nginx -t
   docker exec nginx nginx -s reload
   ```

4. **Verify deployment**:

   ```bash
   # Test nginx configuration
   docker exec nginx nginx -t

   # Reload nginx
   docker exec nginx nginx -s reload

   # Test that nginx is forwarding to Traefik over the internal Docker network
   docker exec nginx curl -H "Host: test.when.party" http://traefik-tempsites:8000
   # (If curl is missing in the nginx container, install it once with: docker exec nginx apk add --no-cache curl)
   ```

### Cloudflare DNS Setup

Ensure your Cloudflare DNS has the wildcard record:

```
Type    Name     Content           Proxy Status
A       @        YOUR_VPS_IP       Proxied (☁️)  # when.party apex
A       *        YOUR_VPS_IP       Proxied (☁️)  # *.when.party wildcard
```

Or if Cloudflare doesn't support wildcard subdomain proxying for your plan, use DNS-only mode.

### Cloudflare SSL/TLS Settings

1. Go to Cloudflare Dashboard → SSL/TLS
2. Set mode to **"Full (strict)"**
3. Enable "Always Use HTTPS"

## Configuration Details

### What This Config Does

1. **HTTP → HTTPS Redirect**: All HTTP requests to `*.when.party` are redirected to HTTPS
2. **TLS Termination**: Nginx terminates TLS using the Cloudflare Origin Certificate
3. **Proxy to Traefik**: All HTTPS requests are proxied to the Traefik router on `traefik-tempsites:8000` via the shared `wp_tempsites` Docker network. Use `docker exec nginx curl ... http://traefik-tempsites:8000` to debug requests from the proxy container.
4. **WebSocket Support**: Includes upgrade headers for WebSocket connections
5. **Security Headers**: Pulls in `/etc/nginx/conf.d/includes/security-headers.conf` for baseline hardening and appends temp-site specific policies
6. **Cloudflare Real IP**: Extracts the real client IP from Cloudflare headers

### Certificate Paths

The config expects certificates at:

- Certificate: `/etc/nginx/certs/when.party.crt`
- Private Key: `/etc/nginx/certs/when.party.key`

These paths are inside the nginx container. They map to:

- Host: `/opt/services/whenparty/infra/nginx/certs/when.party.crt`
- Host: `/opt/services/whenparty/infra/nginx/certs/when.party.key`

## Troubleshooting

### Certificate Error

If you see "SSL certificate not found":

```bash
# Check certificate files exist
ls -la /opt/services/whenparty/infra/nginx/certs/when.party.*

# Check permissions
ls -la /opt/services/whenparty/infra/nginx/certs/

# Verify certificate content
openssl x509 -in /opt/services/whenparty/infra/nginx/certs/when.party.crt -text -noout
```

### Nginx Won't Reload

```bash
# Test configuration
docker exec nginx nginx -t

# Check logs
docker logs nginx

# Restart nginx if needed
cd /opt/services/whenparty/infra
docker compose restart nginx
```

### Traefik Connection Error

```bash
# Verify Traefik is running
docker ps | grep traefik-tempsites

# Test Traefik directly
docker exec nginx curl -H "Host: test.when.party" http://traefik-tempsites:8000
# (Install curl once if needed: docker exec nginx apk add --no-cache curl)

# Check Traefik logs
docker logs traefik-tempsites
```

### Automated Cloudflare IP Updates

Run `/opt/services/whenparty/infra/scripts/update-cloudflare-real-ip.sh` (or `./scripts/update-cloudflare-real-ip.sh` from the infra repo) on the VPS to regenerate `/opt/services/whenparty/infra/nginx/conf.d/cloudflare_real_ip.conf`. Schedule it with cron/systemd to refresh daily:

1. The script downloads the official IPv4 and IPv6 lists from Cloudflare.
2. It writes the combined `set_real_ip_from` directives to the target file, preserving a generated timestamp.
3. When the file changes it validates the nginx config and reloads the proxy.

Run it once after provisioning to replace the placeholder file that ships in git.

## Updating the Config

If you need to update the nginx config:

1. Edit `nginx-config/temp-sites.conf` in this repo
2. Copy to infra repo (see "Copy nginx config" above)
3. Test and reload:
   ```bash
   docker exec nginx nginx -t
   docker exec nginx nginx -s reload
   ```

## Security Notes

- The certificate is valid for 15 years - no renewal needed
- Only Cloudflare can reach your VPS (configure firewall to allow only Cloudflare IPs)
- All temp site traffic goes through HTTPS
- Containers are isolated on the `wp_tempsites` network
- No internal communication between temp site containers
