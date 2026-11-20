# Games check scope

## Context

As [ci-checks.md](/docs/decisions/ci-checks.md) decides, `ci.yml` checks every pull request and every push to `main`, and `games.yml` checks `games/` before it deploys. `games.yml` deploys only the [deployments](/docs/glossary.md#deployment) a change reaches: the titles, the index page and signaling, which are packages with a `compose.yml`, and `games/platform/turn/`. `games/` is one [pnpm workspace](/games/docs/workspace.md) of nine packages: the root, the platform packages transport, rooms, netcode, p2p and signaling, two titles, and the index page. Its tests and typechecks take about 20 seconds. They run in the [Node image](/.github/docs/checks.md#the-checks) of the games' Dockerfiles, which has no git. `games/platform/turn/` has no package; it has its own [smoke test](/games/platform/turn/docs/smoke-test.md). A file directly in `games/`, such as `pnpm-lock.yaml`, can change every package. The browser tests of `games/`, such as those of a connection through the TURN relay, also start a browser and coturn, as [browser-tests.md](/games/docs/decisions/browser-tests.md) decides.

Each deployment with a `Dockerfile` builds its image from `games/`, copying only the files of the packages that its Dockerfile names; the tests and typechecks run with every package of the workspace installed, so they do not notice a Dockerfile that leaves out a package. A Dockerfile that leaves out a package breaks the build when the build runs the package's code, as a title's build does; signaling's build only installs its packages and copies their code, so a missing folder of code shows only when the container starts. `games.yml` runs `deploy-project.yml`, which builds and pushes the image, once per reached deployment, in a matrix that does not stop the other jobs when one fails.

The GitHub runner has git. `pnpm/action-setup` installs on it the pnpm version that `packageManager` in `games/package.json` names, as a standalone binary that needs no Node. `pnpm --filter "...[<commit>]"` selects the packages with files changed since that commit and the packages that depend on them, without an install. It counts a file outside every package as a change to the root package, and fails when the commit is not in the history.

## Options

This decision has six parts.

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

Which images the checks build:

- None: only `deploy-project.yml` builds them. No build besides the deploy's. A Dockerfile that misses a package fails only on `main`, in its own deploy, while the other deployments of the push go live.
- The images of the deployments that a change reaches. A broken Dockerfile fails in its pull request and, before a deploy, stops the push; a broken Dockerfile of a deployment the push does not reach stops nothing. The checks build each reached image besides the deploy's build. Images get a condition of their own, apart from the tested packages, so the check in `games.yml` has to wait for the deployments that `games-changes.yml` finds.
- Every image when every package is checked, and otherwise the images of the reached deployments. One condition for tests and images. A broken Dockerfile anywhere stops every deployment of a push that checks every package, which `games.yml` always does. The checks build each reached image besides the deploy's build, and `games.yml` also builds every other image, so each deploy waits for builds of images that it does not deploy.

Whether the checks start the images they build:

- Build only. No time for starting containers and waiting for their health checks, and a Dockerfile needs no `HEALTHCHECK`. A signaling image that misses a folder of code passes and fails on the VPS.
- Build, start each image and wait for its health check. A signaling image that cannot start fails in its pull request. Each image adds the seconds its container takes to pass its health check, and every Dockerfile of a deployment needs a `HEALTHCHECK`.

## Decision

`ci.yml` runs the changed packages and those that depend on them, so the browser tests of a title do not run for changes to other titles. Finding the affected packages costs less than running them. A build tool would cost more upkeep than it saves for nine packages.

A shared workflow finds the changed packages with pnpm's git filter on the runner. pnpm already knows the workspace, so the workflow adds only what pnpm cannot: it ignores Markdown, handles `platform/turn/` on its own, and makes every package affected when pnpm selects the root package or fails. One more action costs less than a mapping that has to follow every change to the package layout.

`games.yml` deploys the deployments that the same workflow finds, so checks and deploys agree on what a change reaches.

`games.yml` runs the whole workspace before a deploy, because it is the last check before the VPS and takes about 20 seconds today.

`check-games.yml` builds and starts the images of the deployments that a change reaches, in `ci.yml` and before each deploy in `games.yml`. In `ci.yml` it builds every image when `ci.yml`, `check-games.yml`, `games.yml` or `games-changes.yml` changes, as it tests every package then, so that a change to the checks builds them all. It starts each image and waits for its health check, because a build alone passes a signaling image that cannot start. A broken Dockerfile fails in the pull request that reaches its deployment, and a Dockerfile that does not build no longer leaves some deployments of a push live and others not. Each build costs runner time, and an image that a push does not deploy is not worth building before the push's deploy; a second condition and a check in `games.yml` that starts 10 to 25 seconds later, after `games-changes.yml`, cost less.

## Consequences

- [games-changes.yml](/.github/workflows/games-changes.yml) and [games-changes.md](/.github/docs/games-changes.md).
- The `games-changes` and `games` jobs of [ci.yml](/.github/workflows/ci.yml), [check-games.yml](/.github/workflows/check-games.yml) and [games.yml](/.github/workflows/games.yml).
