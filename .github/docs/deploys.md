# Deploys

Each deploy workflow runs on a push to `main` that changes a file in its folder other than Markdown, or a workflow file in its `paths`.

| Workflow | Folder | Also starts on a change to | Deploys | Manual run |
| --- | --- | --- | --- | --- |
| `infra.yml` | `infra/` | itself | the nginx proxy, as [infra.yml](#infrayml) says | no |
| `www.yml` | `www/` | itself, `site.yml` | `www/` through `site.yml` | no |
| `nii-au.yml` | `nii-au/` | itself, `site.yml` | `nii-au/` through `site.yml` | no |
| `temp-sites.yml` | `temp-sites/projects/` | itself, `deploy-project.yml` | each changed project through `deploy-project.yml` | no |
| `traefik.yml` | `temp-sites/traefik/` | itself | the Traefik router | yes |
| `games.yml` | `games/` | itself, `deploy-project.yml` | each [deployment](/docs/glossary.md#deployment) a change reaches, through `deploy-project.yml` | yes |

So merging a change to `site.yml` redeploys both sites, and a change to `infra.yml` or `traefik.yml` redeploys what it deploys. `games.yml` and `temp-sites.yml` deploy only the deployments that a change reaches, so a change to their workflows or to `deploy-project.yml` alone deploys nothing. No deploy workflow lists a `check-*.yml` file, so a change to a check deploys nothing. [image-scan.md](/.github/docs/image-scan.md) says which deploys scan their images and when a scan stops a deploy.

## infra.yml

`infra.yml` deploys only after `check-nginx.yml` passes. It copies `docker-compose.yml`, `nginx/conf.d/` and `scripts/` to `/opt/services/whenparty/infra/`, runs `docker compose up -d`, checks the configs with `nginx -t` in the running container and reloads nginx. It also keeps the Cloudflare address list and its hourly job in place, as [cloudflare-ip-list.md](/infra/docs/cloudflare-ip-list.md) says.

Before it starts nginx, it creates the networks that nginx joins when they are missing. nginx does not start while a network in its `docker-compose.yml` is missing, so a new network there also goes into the networks that `infra.yml` creates.

What the deploy leaves behind:

- The copy adds and overwrites files but never deletes them. A config or script removed from `infra/` stays on the VPS, and nginx keeps loading a removed config until someone deletes it there.
- `docker compose up -d` recreates the container only when the compose file or the image changes. Otherwise a change to a config takes effect through the reload.
- When the configs fail `nginx -t` on the VPS, the deploy stops before the reload. nginx keeps serving the old configs unless `docker compose up -d` recreated the container, in which case it is already down. The new files stay on disk, so the container fails to start at its next restart until the configs are fixed.

## site.yml

`site.yml` deploys `www/` or `nii-au/` as the image `ghcr.io/whenparty/<folder>:latest`. It copies only the folder's `docker-compose.yml` to the VPS, so another file that the compose file needs never reaches the VPS. It does not create the `wp_www` network that both sites join, as [setup.md](/infra/docs/setup.md#vps) says.

## deploy-project.yml

`deploy-project.yml` deploys one deployment of `games/` or `temp-sites/projects/`. Its callers name the image after the last part of the folder's path.

- When the folder has a `Dockerfile`, it builds the image and pushes it with the tags `latest` and `sha-<commit>`. Each image has its own build cache scope, so images built side by side do not evict each other's cache.
- It copies the folder to the same path under `/opt/services/whenparty/` and runs `docker compose up -d --remove-orphans` there, with `IMAGE` set to the `sha-<commit>` image when it built one. The copy never deletes files, so a file removed from a folder that still exists stays on the VPS.
- When the folder's `compose.yml` names `TURN_SECRET`, it writes the secret to a private `.env` next to it when the secret is set, and otherwise warns. [github-setup.md](/.github/docs/github-setup.md) says which deployments use it.
- When the folder is gone, it runs `docker compose down` on the VPS and deletes the folder there.
- It creates the network that its caller names when it is missing: `games.yml` names `wp_games`, and `temp-sites.yml` names `wp_tempsites`.

Deployment names of `games/` and `temp-sites/projects/` share one namespace, and `check-project-names.yml` checks it.

## Which deployments a push reaches

`games.yml` and `temp-sites.yml` compare the pushed commit with the commit before the push. When the event has none, as in a manual run, they compare with the empty tree, because the repository has several root commits and no single first one. So a manual run of `games.yml` deploys every deployment of `games/`. Run it after a push whose deploy failed or was skipped, because the next push deploys only what it changes. [games-changes.md](/.github/docs/games-changes.md) says which changes in `games/` reach which deployments.

## traefik.yml

`traefik.yml` writes the dashboard's basic auth hash to `.env` on the VPS with each `$` written as `$$`, because `docker compose` reads `$` in `.env` as the start of a variable.
