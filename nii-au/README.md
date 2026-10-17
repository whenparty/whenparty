# nii.au Site

The static site at `https://www.nii.au` (`nii.au` redirects to it). It deploys only to the nii.au domain. The When Party site lives in `../www/`.

## Files

- `html/` - the site content
- `Dockerfile` - nginx image that serves `html/` with gzip enabled
- `docker-compose.yml` - the `nii-au` container on the `wp_www` network (no published ports)

The public-facing nginx config for this site is in `nginx/conf.d/` in the repo root. It ships with the nginx deploy, not with this folder.

## Deployment

A push to `main` that changes files under `nii-au/` (Markdown excluded) runs `.github/workflows/nii-au.yml`, which calls the shared `site.yml`:

1. builds the image and scans it with Trivy (critical findings stop the deploy)
2. pushes `ghcr.io/whenparty/nii-au:latest`
3. copies `docker-compose.yml` to `/opt/services/whenparty/nii-au` and runs `docker compose pull && docker compose up -d`

To update the site, edit `html/` and push.

## Local Testing

```bash
cd nii-au
docker build -t nii-au:local .
docker run --rm -p 3000:80 nii-au:local
```

Then open http://localhost:3000.

## Troubleshooting

```bash
cd /opt/services/whenparty/nii-au
docker compose ps
docker compose logs
```

If the site returns 502, check that the `nii-au` container is running and attached to `wp_www` (`docker network inspect wp_www`).
