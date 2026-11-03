# Checks in CI

## Context

The deploy workflows run on a push to `main` and hold the VPS SSH key and other secrets. `games.yml` runs the tests and typechecks of `games/`, the TURN smoke test and the project name check in the same run that deploys, and `infra.yml` runs `nginx -t` the same way. `temp-sites.yml`, `traefik.yml`, `www.yml` and `nii-au.yml` run none of these checks. No ruleset on `main` requires a pull request or a check, as [main-branch-protection.md](/docs/decisions/main-branch-protection.md) decides, and changes reach it through pull requests or direct pushes, such as a quick temporary site. A workflow that runs on `pull_request` gets the repository secrets when the pull request comes from a branch of this repository.

GitHub keeps a required status check pending when `paths` keeps its workflow from running. A job skipped by `if:` counts as successful, and so does a job skipped because a job it needs failed. Workflows that the same push starts run side by side, and a deploy workflow does not wait for one it does not call.

## Options

This decision has three parts.

Where the checks of a pull request run:

- The previous setup: no checks on pull requests. No extra workflows. A problem shows only after merging, in the run that deploys.
- `pull_request` added to the deploy workflows, with deploy jobs limited to pushes. The fewest changes. The secrets reach the pull request, and one wrong condition deploys an unchecked branch.
- The checks as reusable workflows, called before the deploys of `games.yml` and `infra.yml` and by a separate `ci.yml` without deploy jobs or secrets. More files. A pull request cannot deploy.

How a check that a change does not need is skipped:

- A workflow per project with `paths`. Each file is simple to read. A skipped workflow leaves a required status check pending.
- One `ci.yml` whose first job finds the changed projects, with an `if:` on every check and one job that fails when any check failed or was cancelled. A skipped check counts as passed, so any check can become required. The file is longer and needs that last job.

When `ci.yml` runs:

- On pull requests only. Each change is checked once. A direct push gets only the checks of the deploy it starts, and a push to `temp-sites/` gets none.
- On pull requests and on pushes to `main`. A direct push also gets the word limit, the project name check for `temp-sites/`, and the checks of a push that changes only a `check-*.yml` file, which starts no deploy. A push that deploys runs that deploy's checks twice, and a merged pull request runs `ci.yml` once more. On a direct push, `ci.yml` reports a problem only after the deploy has started.

## Decision

The checks of the projects are reusable workflows, the word limit is a job of `ci.yml`, and `ci.yml` runs them without deploy jobs or secrets, so a mistake in it cannot deploy. A few more files cost less than secrets in pull request runs.

`ci.yml` skips checks with `if:`, so a check can become required without blocking the changes that do not need it. One longer file with a final job costs less than checks that cannot be required.

`ci.yml` runs on pull requests and on pushes to `main`, so a direct push gets every check a pull request gets. On a push, `ci.yml` runs only the checks of what it changes, and the deploy does not wait for them, so a quick experiment such as a temporary site is not slowed down. The repeated runs use runner time, and nobody waits for them. A problem in a direct push shows after its deploy has started, which is still earlier than the next pull request that touches the same files.

## Consequences

- [ci.yml](/.github/workflows/ci.yml), the `check-*.yml` workflows it calls, and the deploy workflows that call them, [games.yml](/.github/workflows/games.yml) and [infra.yml](/.github/workflows/infra.yml).
- [.github/docs/checks.md](/.github/docs/checks.md).
