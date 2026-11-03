# Games check scope

## Context

As [ci-checks.md](/docs/decisions/ci-checks.md) decides, `ci.yml` checks every pull request and every push to `main`, and `games.yml` checks `games/` before it deploys. `games.yml` deploys only the [deployments](/docs/glossary.md#deployment) a change reaches: the titles and signaling, which are packages with a `compose.yml`, and `games/platform/turn/`. `games/` is one pnpm workspace of five packages: the root, the platform packages p2p and signaling, and two titles that import p2p. Its tests and typechecks take about 20 seconds. They run in the Node image of the games' Dockerfiles, which has no git. `games/platform/turn/` has no package; it has its own smoke test. A file directly in `games/`, such as `pnpm-lock.yaml`, can change every package. The repository has no slow tests yet, and the [open questions](/docs/open-questions.md#browser-tests) expect browser tests for requirements such as a connection through the TURN relay.

The GitHub runner has git. `pnpm/action-setup` installs on it the pnpm version that `packageManager` in `games/package.json` names, as a standalone binary that needs no Node. `pnpm --filter "...[<commit>]"` selects the packages with files changed since that commit and the packages that depend on them, without an install. It counts a file outside every package as a change to the root package, and fails when the commit is not in the history.

## Options

This decision has four parts.

What `ci.yml` runs in `games/`:

- The whole workspace. The simplest, and fast today. Once a title has slow tests, such as browser tests, a change to another title runs them too.
- The changed packages and the packages that depend on them, and the whole workspace when a file outside the packages changes. Slow tests of a title run only when it or a package it uses changes. Something has to map changed files to packages.
- A build tool such as Bazel or Nx. Fast on large repositories with long builds. It needs build files in every folder, and they need upkeep.

How the changed packages are found:

- pnpm's git filter inside the Node image. pnpm maps files to packages, and no extra action is needed. The image needs the whole repository and git, which it lacks.
- The previous decision: the `changes` job of `ci.yml` finds the changed files with `git diff`, takes the first two folders under `games/` of each file as its package, and passes those folders to pnpm in the image. No extra action. The mapping is code to maintain, and a package at another depth, such as one in `games/platform/` itself, needs a change to it.
- pnpm's git filter on the runner. pnpm maps files to packages and their dependents at any depth. It needs one more pinned action. The tests still run in the image.

Which deployments `games.yml` deploys:

- The previous setup: its own mapping from changed files to deployments. A change to the deploy mapping cannot change what the checks run. The two mappings can disagree.
- The affected packages that have a `compose.yml`, from the same workflow that finds the packages for `ci.yml`, and `games/platform/turn/` when its files change. Checks and deploys share one mapping. A deploy depends on pnpm, and a pnpm failure redeploys every deployment.

What `games.yml` runs before a deploy:

- The whole workspace. Every deploy checks everything it could break, and nothing depends on finding the right packages.
- The same packages as `ci.yml`. Faster once tests are slow, with the same mapping between the change and the VPS.

## Decision

`ci.yml` runs the changed packages and those that depend on them, so the browser tests the open questions expect will not run for changes to other titles. Finding the affected packages costs less than that once those tests exist. A build tool would cost more upkeep than it saves for five packages.

A shared workflow finds the changed packages with pnpm's git filter on the runner. pnpm already knows the workspace, so the workflow adds only what pnpm cannot: it ignores Markdown, handles `platform/turn/` on its own, and makes every package affected when pnpm selects the root package or fails. One more action costs less than a mapping that has to follow every change to the package layout.

`games.yml` deploys the deployments that the same workflow finds, so checks and deploys agree on what a change reaches.

`games.yml` runs the whole workspace before a deploy, because it is the last check before the VPS and takes about 20 seconds today.

## Consequences

- [games-changes.yml](/.github/workflows/games-changes.yml) and [games-changes.md](/.github/docs/games-changes.md).
- The `games-changes` and `games` jobs of [ci.yml](/.github/workflows/ci.yml), [check-games.yml](/.github/workflows/check-games.yml) and [games.yml](/.github/workflows/games.yml).
