# Temp Sites

Disposable web applications for `*.when.party`. Projects live in this repo, build into container images, and deploy behind the shared Traefik router that sits behind the public Nginx proxy.

```
Internet → Cloudflare → Nginx (TLS) → Traefik (HTTP) → Project containers
```

## Architecture at a Glance

- **Nginx (infra repo)** – Terminates TLS with the Cloudflare Origin certificate and forwards every `*.when.party` request to the Traefik router. The wildcard server block lives in `nginx-config/` and the deploy workflow syncs it to `/opt/services/whenparty/infra/nginx/conf.d/temp-sites.conf`.
- **Traefik router** – Long-running container (named `traefik-tempsites`) on the `wp_tempsites` Docker network listening on port 8000. It discovers containers via Docker labels and routes purely by `Host`.
- **Temp projects (this repo)** – Each project folder contains a `compose.yml` and, optionally, a `Dockerfile`. Containers join the shared external network `wp_tempsites` so Traefik can see them.
- **GitHub Actions** – On pushes to `main`, the workflow detects changed projects, builds/pushes images to GHCR, then SSHes into the VPS to `git pull` this repo and `docker compose up -d --remove-orphans` the affected project(s).

## Repository Layout

```
nginx-config/
  temp-sites.conf             # Wildcard server block (copy to infra repo)
projects/
  <project>/
    Dockerfile                # Optional – build instructions for GHCR
    compose.yml               # Required – service definition + Traefik labels
    README.md                 # Project specific notes
    ...project assets...
```

The Cloudflare real IP allow list lives in the infrastructure repository (`infra/nginx/conf.d/cloudflare_real_ip.conf`) and is refreshed by automation on the VPS.

## First-Time VPS Preparation

1. Install the Cloudflare Origin certificate as described in `nginx-config/README.md` and load the wildcard server block in your infra repo.
2. Set up an automated task (cron/systemd/service) on the VPS to refresh `/opt/services/whenparty/infra/nginx/conf.d/cloudflare_real_ip.conf` using `whenparty/infra/scripts/update-cloudflare-real-ip.sh` (see `nginx-config/README.md` for details).
3. Create the shared Docker network (once):
   ```bash
   docker network create wp_tempsites
   ```
4. Ensure the target directory `/opt/services/whenparty/tempsites` exists. The GitHub Actions workflow uploads the required project files and nginx config to the VPS on each deployment, so no manual clone is needed.
5. Ensure a Traefik router container named `traefik-tempsites` is running on the `wp_tempsites` network and listening on `:8000` so nginx can reach it.

Ensure the VPS user that runs deployments can pull from GitHub using the SSH key referenced in the GitHub Action secrets.

## GitHub Secrets

Configure these secrets in the `temp-sites` repository:

- `VPS_HOST` – Deploy target IP/hostname
- `VPS_USER` – Deploy user
- `VPS_DEPLOY_KEY` – SSH private key with access to the VPS

## Deployment Pipeline

1. `detect-changes` job computes which `projects/*` directories changed in the push.
2. For each changed project, `build-and-deploy`:
   - Builds a GHCR image if a `Dockerfile` exists (tags: `latest` + `sha-<commit>`).
   - Attempts to set the container package visibility to public (falls back to manual if the API call is not permitted).
   - SSHes into the VPS, fetches this repo, checks out the commit, ensures the `wp_tempsites` network exists, and runs `docker compose up -d --remove-orphans` inside the project directory. If an image was built, the deployment uses the `sha-<commit>` tag so the rollout is deterministic.
   - Copies `nginx-config/temp-sites.conf` into `/opt/services/whenparty/infra/nginx/conf.d/temp-sites.conf`, validates the proxy config, and reloads nginx.
   - Prunes dangling images after the update.

## Adding a New Project

1. Create a folder under `projects/<name>/`.
2. Add a `Dockerfile` (optional but recommended). Example static site:
   ```dockerfile
   FROM nginx:1.29.3-alpine
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

4. Commit, push to `main`, and wait for the workflow. Traefik routes traffic as soon as the container is healthy.

## Local Development

Each project is self-contained. To build/test locally:

```bash
cd projects/my-site
docker build -t my-site:test .
docker run --rm -p 8080:80 my-site:test
# or, to use compose:
IMAGE=my-site:test docker compose up -d
```

Stop or clean resources with:

```bash
docker compose down -v    # inside the project directory
```

## Maintenance

- **Remove a temp site**: delete the project folder (and optionally run `docker compose down -v` on the VPS). The next deployment removes the container because `--remove-orphans` is enabled.
- **Cloudflare real IP allow list**: schedule `infra/scripts/update-cloudflare-real-ip.sh` to refresh `/opt/services/whenparty/infra/nginx/conf.d/cloudflare_real_ip.conf` whenever Cloudflare updates their ranges. The repo ships a placeholder so nginx can reload before automation is in place.
- **Secrets**: Never bake secrets into images. Inject them on the VPS using compose `env_file` entries or environment variables that live outside the repo.
- **Traefik tweaks**: Change routing behaviour in the project `compose.yml` via additional labels (middlewares, custom services, etc.).

## Troubleshooting

- Check GitHub Actions logs for build or deployment errors.
- On the VPS, inspect container status with `docker compose ps` inside the project directory, or view logs with `docker compose logs -f`.
- Traefik dashboard and logs live with the infra repository; confirm the container carries the expected labels if routing fails.
