# Temp Sites

Disposable web apps on `*.when.party`. Each project builds into a container image and runs behind the shared Traefik router, which sits behind the nginx proxy from this repo.

```
Internet → Cloudflare → nginx (TLS, infra/nginx/conf.d/temp-sites.conf) → Traefik (HTTP :8000) → project container
```

## Layout

```
temp-sites/
  traefik/                  # Traefik router (deployed by .github/workflows/traefik.yml)
  projects/
    <project>/
      compose.yml           # Required: service definition + Traefik labels
      Dockerfile            # Optional: image built and pushed to GHCR
      README.md             # Project notes
```

The wildcard nginx config for `*.when.party` lives with the other nginx configs in `infra/nginx/conf.d/temp-sites.conf`. Adding a project never touches nginx.

The peer-to-peer games and their signaling server live in [`games/`](/games/AGENTS.md) at the top of the repo. They are routed by this Traefik and the same nginx config.

## Deployment

On a push that changes `temp-sites/projects/**` (Markdown excluded), `.github/workflows/temp-sites.yml` (with the reusable `deploy-project.yml`):

1. finds which project folders changed
2. for each one, builds and pushes `ghcr.io/whenparty/<project>` (`latest` + `sha-<commit>`) if it has a `Dockerfile`
3. copies the project folder to `/opt/services/whenparty/temp-sites/projects/<project>` and runs `docker compose up -d --remove-orphans` with the `sha-<commit>` image
4. if the folder was deleted, runs `docker compose down` and removes it from the VPS

Unchanged projects are never rebuilt or restarted.

The first push of a new image creates its GHCR package. Make it public and make sure this repo (`whenparty/whenparty`) has Write access under Package settings → Manage Actions access.

## Adding a Project

1. Create `temp-sites/projects/<name>/`.
2. Add a `Dockerfile`, for example a static site:
   ```dockerfile
   FROM nginx:1.31.7-alpine
   COPY site/ /usr/share/nginx/html/
   HEALTHCHECK CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1
   ```
3. Add `compose.yml` with Traefik labels:

   ```yaml
   name: tempsite-my-site

   services:
     app:
       image: ${IMAGE:-ghcr.io/whenparty/my-site:latest}
       restart: unless-stopped
       labels:
         - "traefik.enable=true"
         - "traefik.http.routers.my-site.rule=Host(`my-site.when.party`)"
         - "traefik.http.routers.my-site.entrypoints=web"
         - "traefik.http.services.my-site.loadbalancer.server.port=80"
       networks:
         - wp_tempsites

   networks:
     wp_tempsites:
       external: true
   ```

4. Push to `main`. Traefik routes the host as soon as the container is up.

## Local Development

```bash
cd temp-sites/projects/my-site
docker build -t my-site:test .
docker run --rm -p 8080:80 my-site:test
# or through compose:
IMAGE=my-site:test docker compose up -d
docker compose down -v
```

## Maintenance

- **Remove a site**: delete its project folder and push.
- **Secrets**: never bake them into images. Put them on the VPS with compose `env_file` entries or environment variables kept outside the repo.
- **Routing tweaks**: add Traefik labels (middlewares, extra routers) in the project's `compose.yml`.

## Troubleshooting

- Check the GitHub Actions logs first.
- On the VPS: `docker compose ps` and `docker compose logs -f` inside `/opt/services/whenparty/temp-sites/projects/<name>`.
- `docker logs traefik-tempsites` shows whether Traefik picked up the container's labels.
