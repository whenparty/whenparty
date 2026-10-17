# When Party Site (www)

The site at `https://www.when.party` (`when.party` redirects to it). For now it is a one-page landing: the name and a contact address. The nii.au site lives in `../nii/`.

It follows the **Pencil & Gouache** design system: graphite pencil lines on off-white paper, Golos Text, and color only on what matters, here a denim gouache band under the contact address. The colors in `html/styles.css` are the system's tokens, light and dark. The pencil and wash effects are inline SVG filters in `html/index.html`.

## Files

- `html/` - `index.html` and `styles.css`
- `Dockerfile` - nginx image that serves `html/`
- `docker-compose.yml` - the `www` container on the `wp_www` network (no published ports)

The public nginx config for this site is `nginx/conf.d/www.conf` in the repo root. It ships with the nginx deploy.

## Deployment

A push to `main` that changes files under `www/` (Markdown excluded) runs `.github/workflows/www.yml`, which calls the shared `site.yml`: build, Trivy gate, push `ghcr.io/whenparty/www:latest`, then `docker compose pull && docker compose up -d` in `/opt/services/whenparty/www` on the VPS.

## Local Testing

```bash
cd www
docker build -t www:local .
docker run --rm -p 3001:80 www:local
```

Then open http://localhost:3001.

The page's Content-Security-Policy (set in `www.conf`) allows only its own files and Google Fonts. Keep styles in `styles.css`: inline `style` attributes and `<style>` blocks are blocked.
