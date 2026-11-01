# Games check scope

## Context

As [ci-checks.md](/docs/decisions/ci-checks.md) decides, `ci.yml` checks every pull request and every push to `main`. Its first job, `changes`, runs on the GitHub runner, which has git, and finds what changed. `games/` is one pnpm workspace of five packages: the root, the platform packages p2p and signaling, and two titles that import p2p. Its tests and typechecks take about 20 seconds. They run in the Node image of the games' Dockerfiles, which has no git. `games/platform/turn/` has no package, so pnpm does not see it; its smoke test runs on its own. A file directly in `games/`, such as `pnpm-lock.yaml`, can change every package. The repository has no slow tests yet, and the [open questions](/docs/open-questions.md#browser-tests) expect browser tests for requirements such as a connection through the TURN relay.

## Options

This decision has three parts.

What `ci.yml` runs in `games/`:

- The whole workspace. The simplest, and fast today. Once a title has slow tests, such as browser tests, a change to another title runs them too.
- The changed packages and the packages that depend on them, through a pnpm filter, and the whole workspace when a file outside the packages changes. Slow tests of a title run only when it or a package it uses changes. The mapping from files to packages is code to maintain.
- A build tool such as Bazel or Nx. Fast on large repositories with long builds. It needs build files in every folder, and they need upkeep.

How the changed packages reach pnpm:

- pnpm's own git filter inside the container. pnpm decides what changed. The container needs the whole repository and git, and the `changes` job still has to recognise files outside the packages and `platform/turn/`.
- The `changes` job finds the changed package folders with `git diff` and passes them to pnpm in the container as path filters. One place decides what runs, and the container stays as it is. The mapping is code we maintain instead of pnpm's.
- pnpm on the runner. pnpm's own git filter works, because the runner has git. It needs a Node setup action, and the Node version no longer comes from the games' image.

What `games.yml` runs before a deploy:

- The whole workspace. Every deploy checks everything it could break, and nothing depends on finding the right packages.
- The same packages as `ci.yml`. Faster once tests are slow, with the same mapping between the change and the VPS.

## Decision

`ci.yml` runs the changed packages and those that depend on them, so the browser tests the open questions expect will not run for changes to other titles. Keeping the mapping costs less than that once those tests exist. A build tool would cost more upkeep than it saves for five packages.

The `changes` job passes the changed package folders to pnpm. It already has to decide about files outside the packages and `platform/turn/`, so one place decides, and the Node version keeps coming from the games' image.

`games.yml` runs the whole workspace before a deploy, because it is the last check before the VPS and takes about 20 seconds today.

## Consequences

- The `changes` job of [ci.yml](/.github/workflows/ci.yml), [check-games.yml](/.github/workflows/check-games.yml) and [games.yml](/.github/workflows/games.yml).
