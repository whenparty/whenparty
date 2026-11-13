# GitHub Actions

`.github/` holds the GitHub Actions workflows of this repository in `workflows/`: `ci.yml`, which checks every pull request and every push to `main`, the checks it calls, the deploy workflows, the weekly image scan, and `www-snapshots.yml`, which updates the approved screenshots of `www/` on a pull request. It is not a [project](/docs/glossary.md#project) and has no specification.

- [workflows.md](/.github/docs/workflows.md): rules for every workflow file: action pinning, the permissions and secrets of reusable workflows, and how a change to a workflow can be tried. Read it before changing any workflow.
- [checks.md](/.github/docs/checks.md): `ci.yml` and the `check-*.yml` workflows, and how to add a check. Read it before changing them.
- [deploys.md](/.github/docs/deploys.md): which workflow deploys what, which changes start it, how `infra.yml`, `site.yml`, `deploy-project.yml`, `games.yml`, `temp-sites.yml` and `traefik.yml` work, and what a deploy leaves on the VPS. Read it before changing a deploy workflow or a Compose file that one deploys.
- [games-changes.md](/.github/docs/games-changes.md): how `games-changes.yml` finds the packages and deployments of `games/` that a change reaches. Read it before changing `games-changes.yml` or what `ci.yml` and `games.yml` take from it.
- [image-scan.md](/.github/docs/image-scan.md): `image-scan.yml` and the vulnerability scans of the deploys. Read it before changing `image-scan.yml`, adding a Compose file at a new path, or changing a deploy's scan.
- [github-setup.md](/.github/docs/github-setup.md): the repository secrets and the GitHub Container Registry access and the `update-snapshots` label that the workflows rely on, and the ruleset on `main`. Read it before adding a secret, a deployment that pushes a new image or a label that a workflow reacts to, or proposing a change to the ruleset or a force push to `main`.
- [/www/docs/tests.md](/www/docs/tests.md): how `www-snapshots.yml` updates the approved screenshots of `www/`. Read it before changing `www-snapshots.yml`.
- [screenshot-tests.md](/www/docs/decisions/screenshot-tests.md): why `www-snapshots.yml` makes the approved screenshots of `www/` in CI when a label asks for it, and why `www.yml` does not wait for `check-www.yml`.
- [word-limit.md](/.claude/hooks/docs/word-limit.md): how the `words` job reads the limit and counts like `word-limit.sh`. Read it before changing the `words` job.
- [ci-checks.md](/docs/decisions/ci-checks.md): why the checks are reusable workflows without secrets, why `ci.yml` skips checks with `if:`, and why it runs on pushes to `main` too.
- [games-check-scope.md](/docs/decisions/games-check-scope.md): which packages of `games/` `ci.yml` tests, why pnpm finds them on the runner, which deployments `games.yml` deploys, and why it tests the whole workspace.
- [games-routing.md](/docs/decisions/games-routing.md): why nginx reaches the containers of the games itself, which is why the games deploy onto their own network `wp_games`.
- [game-names-check.md](/docs/decisions/game-names-check.md): why a check of its own keeps other containers off the names that nginx reaches for the games, and why no deploy calls it.
- [main-branch-protection.md](/docs/decisions/main-branch-protection.md): why the ruleset on `main` blocks only force pushes and deletion, and when a ruleset that requires a pull request and the `result` check of `ci.yml` becomes worth it.
