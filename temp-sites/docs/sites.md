# Working on temp sites

Each site is one folder in `projects/`:

```
projects/
  <name>/
    compose.yml   required: the service, its network and its Traefik labels
    Dockerfile    optional: the image the deploy builds from this folder
```

## Adding a site

1. Pick a name that [names.md](names.md) allows.
2. Copy [dtm-cleaning](../projects/dtm-cleaning/), a placeholder site with both files, to `projects/<name>/`.
3. Replace `dtm-cleaning` everywhere in its `compose.yml`, the container name included, and check that file against the next section. Replace the page in `site/`.
4. Ask the user for the DNS record, as [names.md](names.md#hosts) says.
5. Merge to `main`. When the site has a `Dockerfile` and its first deploy fails at the pull, have the user make its new package public, as [deploy.md](deploy.md#the-first-deploy) says.

Every later change to a site deploys when it reaches `main`, and removing its folder takes the site down, as [deploy.md](deploy.md) describes.

## compose.yml

- With a `Dockerfile`, the service image is `${IMAGE:-ghcr.io/whenparty/<name>:latest}`. The deploy sets `IMAGE` to the image of the commit it deploys.
- Without a `Dockerfile`, the service runs the image that `compose.yml` names. The deploy does not pull it again when the VPS already has that tag, so name an exact version, not `latest`.
- The service sets `restart: unless-stopped`, so that it comes back after the VPS or Docker restarts.
- The service joins the external network `wp_tempsites` and publishes no ports.
- Labels set `traefik.enable=true`, a router with a `Host` rule and the `web` entrypoint, and the service port the container listens on. Traefik ignores a container without `traefik.enable=true`. More routing, such as middlewares or extra routers, goes in more labels in the same file. [traefik.md](traefik.md) describes the router.
- The text `TURN_SECRET` appears nowhere in the file, not even in a comment. Where it appears, every deploy overwrites the site's `.env` on the VPS with the games' TURN secret. That deletes the secrets put there by hand and hands the games' secret to the site.

## What a page can load

Inline scripts and styles work. Everything else loads only from the site's own host, apart from images from `data:` URLs and the Cloudflare analytics script. No page can frame the site. The camera, the microphone and geolocation are blocked. A cross-origin popup, such as a payment window, is cut off from the page. Other origins, other temp sites included, cannot embed the site's files.

The proxy limits the requests of each client address, the size of a request's body and how long a site may stay silent, as [2-headers.md](/infra/docs/specs/2-headers.md) of its specification says.

[temp-sites.conf](/infra/nginx/conf.d/temp-sites.conf) sets what loads from where, and a change there applies to every temp site. [default.conf](/infra/nginx/conf.d/default.conf) sets the rest, apart from the [404 pages](#404-pages), and a change there applies to every site on the proxy.

## Secrets and data

GHCR images are public, so an image holds no secrets. Put secrets on the VPS by hand in the site's folder. Compose reads `.env` there only to fill in `${VAR}` in `compose.yml`. The container gets a value only through an `environment:` entry or a file that an `env_file:` entry names. Git ignores `projects/*/.env`, `projects/*/secrets/` and `projects/*/data/`. A deploy keeps these files, and removing the site deletes them. After changing them, run `docker compose up -d` in the site's folder on the VPS, with `IMAGE` set to the image the container runs now, which `docker compose images` shows.

## Running a site locally

```bash
cd temp-sites/projects/<name>
docker build -t <name>:local .
docker run --rm -p 8080:80 <name>:local
```

Then open http://localhost:8080, with the container's port in place of `80` if it differs. The container sends none of the proxy's headers, so a local run does not show what they block. `docker compose up` needs the `wp_tempsites` network, which `docker network create wp_tempsites` makes, and publishes no port, so the site is not reachable from the browser that way.

## 404 pages

Through the proxy, every 404 of a site shows the shared 404 page, and a host without a site shows a page that links to `www.when.party`, as [nginx-configs.md](/infra/docs/nginx-configs.md) says. A site serves nothing under `/_errors/`. A site that needs its own 404 body, such as an API's JSON, needs a server with its exact name in `infra/`, as nginx-configs.md says.

## Troubleshooting

- Read the log of the deploy job in GitHub Actions first.
- On the VPS, run `docker compose ps` and `docker compose logs -f` in the site's folder.
- When the container runs but the host does not answer, follow [traefik.md](traefik.md#troubleshooting).
