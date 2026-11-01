# GitHub Actions

`.github/` holds the GitHub Actions workflows of this repository in `workflows/`. It is not a [project](/docs/glossary.md#project) and has no specification. The [README](/README.md#layout) says which workflow deploys what.

## Working here

- `ci.yml` runs on every pull request and every push to `main`. Keep deploy steps and secrets out of it and out of the checks it calls, and keep their tokens read-only. [ci-checks.md](/docs/decisions/ci-checks.md) explains why.
- The checks other than `words` are reusable workflows: `check-games.yml`, `check-turn.yml`, `check-nginx.yml` and `check-project-names.yml`. `games.yml` and `infra.yml` call theirs before every deploy. The deploy workflows do not list the check files in `paths`, so a change to a check deploys nothing.
- `ci.yml` has no `paths` and skips a check that a change does not need with `if:`, because a workflow that `paths` keeps from running leaves a required status check pending, while a job skipped by `if:` counts as passed. Its `result` job fails when any job it needs failed or was cancelled, so a branch rule on `main`, if one is added, needs to require only `result`. A new check in `ci.yml` gets an output in the `changes` job, which is also true when `ci.yml`, the check's own workflow or the deploy workflow that calls it changes, and goes into the `needs` of `result`.
- [games-check-scope.md](/docs/decisions/games-check-scope.md) explains which packages of `games/` `ci.yml` tests.
- The `words` job counts words the same way as [word-limit.sh](/.claude/hooks/AGENTS.md#word-limitsh), but it also fails when the user decided not to split a document in this change.
- `check-games.yml` runs pnpm in the Node image of the Dockerfiles in `games/`. Change the image in `check-games.yml` and in every Dockerfile in `games/` together.
- The repository has no local check of workflow files. A pull request runs `ci.yml` and the checks from its own branch. A deploy workflow runs only from `main`, except that running `games.yml` or `traefik.yml` by hand on a branch deploys that branch. Each deploy workflow lists in `paths` its own file and, if it calls one, `deploy-project.yml` or `site.yml`, so merging a change to one of these runs it. `infra.yml`, `traefik.yml`, `www.yml` and `nii-au.yml` then deploy. `games.yml` and `temp-sites.yml` deploy only the deployments whose files changed, so a change to their workflows alone deploys nothing.
- A reusable workflow gets only the permissions its caller grants. A caller of `deploy-project.yml` must grant `contents: read` and `packages: write`, and a caller of `site.yml` also `security-events: write`.
- Pin third-party actions as the [README](/README.md#layout) describes.
- `deploy-project.yml` gives each image its own build cache scope, so images built in parallel do not evict each other's cache. Its Trivy scan never fails the deploy; the weekly `image-scan.yml` reports findings, as the README says.
- When the event has no previous commit, `games.yml` and `temp-sites.yml` compare with the empty tree, because the repository has several root commits and no single first one. So a manual run of `games.yml` deploys every [deployment](/docs/glossary.md#deployment) of `games/`. Run it after a push whose deploy failed or was skipped, because the next push deploys only what it changes.
- `traefik.yml` writes each `$` of the dashboard password hash as `$$`, because `docker compose` reads `$` in `.env` as the start of a variable.
