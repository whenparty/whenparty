# GitHub Actions

`.github/` holds the GitHub Actions workflows of this repository in `workflows/`: `ci.yml`, which checks every pull request and every push to `main`, the checks it calls, the deploy workflows and the weekly image scan. It is not a [project](/docs/glossary.md#project) and has no specification.

- [workflows.md](/.github/docs/workflows.md): rules for every workflow file: action pinning, the permissions and secrets of reusable workflows, and how a change to a workflow can be tried. Read it before changing any workflow.
- [checks.md](/.github/docs/checks.md): `ci.yml` and the `check-*.yml` workflows, and how to add a check. Read it before changing them.
- [deploys.md](/.github/docs/deploys.md): which workflow deploys what, which changes start it, how `infra.yml`, `site.yml`, `deploy-project.yml`, `games.yml`, `temp-sites.yml` and `traefik.yml` work, and what a deploy leaves on the VPS. Read it before changing a deploy workflow or a Compose file that one deploys.
- [games-changes.md](/.github/docs/games-changes.md): how `games-changes.yml` finds the packages and deployments of `games/` that a change reaches. Read it before changing `games-changes.yml` or what `ci.yml` and `games.yml` take from it.
- [image-scan.md](/.github/docs/image-scan.md): `image-scan.yml` and the vulnerability scans of the deploys. Read it before changing `image-scan.yml`, adding a Compose file at a new path, or changing a deploy's scan.
- [github-setup.md](/.github/docs/github-setup.md): the repository secrets and the GitHub Container Registry access that the workflows rely on. Read it before adding a secret or a deployment that pushes a new image.
- [word-limit.md](/.claude/hooks/docs/word-limit.md): how the `words` job reads the limit and counts like `word-limit.sh`. Read it before changing the `words` job.
- [ci-checks.md](/docs/decisions/ci-checks.md): why the checks are reusable workflows without secrets, why `ci.yml` skips checks with `if:`, and why it runs on pushes to `main` too.
- [games-check-scope.md](/docs/decisions/games-check-scope.md): which packages of `games/` `ci.yml` tests, why pnpm finds them on the runner, which deployments `games.yml` deploys, and why it tests the whole workspace.
- [game-hosts-check.md](/docs/decisions/game-hosts-check.md): why a check of its own compares the game hosts with `games.conf`, and why no deploy calls it.
