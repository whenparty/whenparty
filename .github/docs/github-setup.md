# GitHub setup

The workflows rely on these settings of the `whenparty/whenparty` repository and its packages.

## Secrets

| Secret | Used by |
| --- | --- |
| `VPS_HOST`, `VPS_DEPLOY_KEY` | every deploy, to copy files to the VPS and run commands there over SSH |
| `VPS_USER` | every deploy, as the deploy user. The deploy user runs `docker`, `docker compose` and `crontab` over SSH. |
| `TRAEFIK_DASHBOARD_USER`, `TRAEFIK_DASHBOARD_PASSWORD` | `traefik.yml`, for the Traefik dashboard login. A new value takes effect at the next run of `traefik.yml`, which can be started by hand. |
| `TURN_SECRET` | `deploy-project.yml`, for each deployment whose `compose.yml` names `TURN_SECRET`: the TURN relay and the signaling server, as the [TURN relay's documentation](/games/platform/turn/AGENTS.md) says |

The workflows push images and upload scan results with the `GITHUB_TOKEN` that GitHub gives every run.

## Container packages

`site.yml` and `deploy-project.yml` push images to `ghcr.io/whenparty/<name>`: `www`, `nii-au`, and every deployment of `temp-sites/projects/` and `games/` that has a `Dockerfile`, such as `signaling` and each game.

- The repository needs Write access to each package, under Package settings → Manage Actions access. A package first pushed from this repository gets it automatically.
- The VPS pulls images without logging in, so every package must be public. After each push, the workflow asks the GitHub API with its `GITHUB_TOKEN` to make the package public, and the deploy goes on when that call fails. The call failed with HTTP 404 in run 40140206942 of `games.yml` on 2026-10-24, even for packages that already existed. So the first deploy of a new package fails at the pull on the VPS until the user makes the package public in its settings and runs the job again.
