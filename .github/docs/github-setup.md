# GitHub setup

These are the settings of the `whenparty/whenparty` repository and its packages that live in GitHub and not in this repository: what the workflows rely on, and the rulesets on `main`.

## Secrets

| Secret | Used by |
| --- | --- |
| `VPS_HOST`, `VPS_DEPLOY_KEY` | every [deploy](/.github/docs/deploys.md), to copy files to the VPS and run commands there over SSH |
| `VPS_USER` | every deploy, as the deploy user. The deploy user runs `docker`, `docker compose` and `crontab` over SSH. |
| `TRAEFIK_DASHBOARD_USER`, `TRAEFIK_DASHBOARD_PASSWORD` | `traefik.yml`, for the Traefik dashboard login. A new value takes effect at the next run of `traefik.yml`, which can be started by hand. |
| `TURN_SECRET` | `deploy-project.yml`, for each [deployment](/docs/glossary.md#deployment) whose `compose.yml` names `TURN_SECRET`: the TURN relay and the signaling server, as the [TURN relay's documentation](/games/platform/turn/docs/deployment.md) says |

The workflows push images and upload scan results with the `GITHUB_TOKEN` that GitHub gives every run.

## Container packages

`site.yml` and `deploy-project.yml` push images to `ghcr.io/whenparty/<name>`: `www`, `blog`, `nii-au`, and every deployment of `temp-sites/projects/` and `games/` that has a `Dockerfile`, such as `signaling` and each game.

- The repository needs Write access to each package, under Package settings → Manage Actions access. A package first pushed from this repository gets it automatically.
- The VPS pulls images without logging in, so every package must be public. A new package first pushed by these workflows is public at once, as `index` was in run 41627417949 of `games.yml`. When a package is private, the deploy fails at the pull on the VPS. The GitHub API cannot change the visibility of a package, so the user makes the package public in its settings and re-runs the failed jobs.

## `main` branch

Two rulesets on `main`, under Settings → Rules → Rulesets, have no bypass:

| Ruleset | Rules |
| --- | --- |
| `main-branch` | blocks force pushes and deletion of the branch |
| `main-pull-requests` | requires a pull request with no required approval, and the status check [`result`](/.github/docs/checks.md#skipping-and-the-result-job) from GitHub Actions, without requiring the branch to be up to date |

So a change reaches `main` only through a pull request whose `result` check passed, unless the user turns `main-pull-requests` off. The user set them by hand, and nothing in the repository creates or checks them. For a direct push to `main`, the user sets the enforcement status of `main-pull-requests` to Disabled, pushes and sets it back to Active. A force push needs both rulesets Disabled. In Claude Code, [ruleset-guard.sh](/.claude/hooks/ruleset-guard.sh) denies an agent's commands that change a ruleset or branch protection, as [ruleset-guard.md](/.claude/hooks/docs/ruleset-guard.md) describes. [main-branch-protection.md](/docs/decisions/main-branch-protection.md) explains why.
