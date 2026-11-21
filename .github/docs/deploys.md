# Deploys

Each deploy workflow runs on a push to `main` that changes a file in its folder other than Markdown, or a workflow file in its `paths`. `blog.yml` also runs on a change to a post in `blog/src/posts/`.

| Workflow | Folder | Also starts on a change to | Deploys | Manual run |
| --- | --- | --- | --- | --- |
| `infra.yml` | `infra/` | itself | the nginx proxy, as [infra.yml](#infrayml) says | no |
| `www.yml` | `www/` | itself, `site.yml` | `www/` through `site.yml` | no |
| `blog.yml` | `blog/` | itself, `site.yml` | `blog/` through `site.yml` | no |
| `nii-au.yml` | `nii-au/` | itself, `site.yml` | `nii-au/` through `site.yml` | no |
| `temp-sites.yml` | `temp-sites/projects/` | itself, `deploy-project.yml` | each changed project through `deploy-project.yml` | no |
| `traefik.yml` | `temp-sites/traefik/` | itself | the Traefik router | yes |
| `games.yml` | `games/` | itself, `deploy-project.yml` | each [deployment](/docs/glossary.md#deployment) a change reaches, through `deploy-project.yml` | yes |

So merging a change to `site.yml` redeploys all three sites, and a change to `infra.yml` or `traefik.yml` redeploys what it deploys. `games.yml` and `temp-sites.yml` deploy only the deployments that a change reaches, so a change to their workflows or to `deploy-project.yml` alone deploys nothing. No deploy workflow lists a `check-*.yml` file, so a change to a check deploys nothing.

[setup.md](/infra/docs/setup.md#vps) says how the Docker networks that the deployments share with nginx are created, and [image-scan.md](/.github/docs/image-scan.md) how the images are scanned.

## infra.yml

`infra.yml` deploys only after `check-nginx.yml` passes. It copies `docker-compose.yml`, `nginx/conf.d/` and `scripts/` to `/opt/services/whenparty/infra/`, runs `docker compose up -d`, checks the configs with `nginx -t` in the running container and reloads nginx. It also keeps the hourly job that refreshes the Cloudflare address list in place, as [cloudflare-ip-list.md](/infra/docs/cloudflare-ip-list.md) says.

What the deploy leaves behind:

- The copy adds and overwrites files but never deletes them. A config or script removed from `infra/` stays on the VPS, and nginx keeps loading a removed config until someone deletes it there.
- `docker compose up -d` recreates the container only when the compose file or the image changes. Otherwise a change to a config takes effect through the reload.
- When the configs fail `nginx -t` on the VPS, the deploy stops before the reload. nginx keeps serving the old configs unless `docker compose up -d` recreated the container, in which case it is already down. The new files stay on disk, so the container fails to start at its next restart until the configs are fixed.

## site.yml

`site.yml` deploys `www/`, `blog/` or `nii-au/` as the image `ghcr.io/whenparty/<folder>:latest`. It copies only the folder's `docker-compose.yml` to the VPS, so another file that the compose file needs never reaches the VPS.

## deploy-project.yml

`deploy-project.yml` deploys one deployment of `games/` or `temp-sites/projects/`. Its callers name the image after the last part of the folder's path.

- When the folder has a `Dockerfile`, it builds the image and pushes it with the tags `latest` and `sha-<commit>`. Each image has its own build cache scope, so images built side by side do not evict each other's cache.
- It copies the folder to the same path under `/opt/services/whenparty/` and runs `docker compose up -d --remove-orphans --wait` there, with `IMAGE` set to the `sha-<commit>` image when it built one. The copy never deletes files, so a file removed from a folder that still exists stays on the VPS.
- When a container does not run, or does not pass its health check, within 2 minutes, it prints `docker compose ps --all` without the containers' logs, which can hold the addresses of visitors and would show in the public run, and fails. A container without a health check only has to run. The new containers stay in place, also one that does not run: nothing rolls back, as [deploy-checks.md](/docs/decisions/deploy-checks.md) decides.
- When the folder's `compose.yml` names `TURN_SECRET`, it writes the secret to a private `.env` next to it when the secret is set, and otherwise warns. [github-setup.md](/.github/docs/github-setup.md) says which deployments use it.
- When the folder is gone, it runs `docker compose down` on the VPS and deletes the folder there.

Deployment names of `games/` and `temp-sites/projects/` share one namespace, and `check-project-names.yml` checks it.

## games.yml

After the deploys, also when some of them failed, the `smoke` job of `games.yml` runs [smoke-games.py](/.github/scripts/smoke-games.py) with every deployment of the run. It checks the live site over public HTTPS, through Cloudflare, needs no secrets and fails the run when a check fails. [deploy-checks.md](/docs/decisions/deploy-checks.md) explains why it checks the live site, opens no room and rolls nothing back.

| Deployment | What it checks |
| --- | --- |
| a title in `games/titles/<name>/` | `https://games.when.party/<name>/`, and each page and file under `/<name>/` that a page names in `src` or `href`, a stylesheet in `url()` or a script as a quoted path that starts with `/` or `./` and ends in an extension, such as a 3D model |
| `games/index/` | `https://games.when.party/`, and each page and file named in the same way whose path goes to the index page, not to a title (`4-1` and `4-3` of [4-games.md](/infra/docs/specs/4-games.md)) |
| `games/platform/signaling/` | `https://signaling.when.party/health`, and a WebSocket upgrade at `/platform` with the origin `https://games.when.party` |
| `games/platform/turn/` and a removed deployment | nothing |

- Each page and file answers 200, and `/health` too. Each response carries once, with its value, every header that the `add_header <name> "<value>" always;` lines of [default.conf](/infra/nginx/conf.d/default.conf) and of the host's server in [games.conf](/infra/nginx/conf.d/games.conf) add, which are those of `2-1` and `2-2` in [2-headers.md](/infra/docs/specs/2-headers.md). The script reads those lines from the commit of the run, so a manual run on a branch that adds such a line or changes its value fails while the VPS runs the proxy of `main`.
- The upgrade answers 101, and the script closes the connection at once. So the connection names no versions and gets no peer ID, and the check opens no room.
- On each attempt, the script adds `smoke=<the current time in nanoseconds>` to the query of each URL on `games.when.party`, so that Cloudflare, which keeps the files of the titles, passes the request to the VPS, as the Caching Level of `when.party` in [setup.md](/infra/docs/setup.md#cloudflare) allows. It also needs that no setting or rule of that zone, such as Bot Fight Mode, challenges requests from GitHub's runners. `/health` answers 404 to a URL with a query, and Cloudflare does not keep it.
- When a check of a deployment fails, the script tries it up to 7 times in all, 5 seconds apart, about 30 seconds, because nginx can send requests to a container's old address for 5 seconds after a deploy, as [sites.md](/infra/docs/sites.md) says. Then it prints each failed URL with its answer.

## Which deployments a push reaches

`games.yml` and `temp-sites.yml` compare the pushed commit with the commit before the push. When the event has none, as in a manual run, they compare with the empty tree, because the repository has several root commits and no single first one. So a manual run of `games.yml` deploys every deployment of `games/`. Run it after a push whose deploy failed or was skipped, because the next push deploys only what it changes. [games-changes.md](/.github/docs/games-changes.md) says which changes in `games/` reach which deployments.
