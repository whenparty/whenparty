# Packages and deployments a games change reaches

[games-changes.yml](/.github/workflows/games-changes.yml) finds the packages and [deployments](/docs/glossary.md#deployment) of `games/` that a change reaches. `ci.yml` passes the packages to `check-games.yml`, as [checks.md](/.github/docs/checks.md) says, and `games.yml` deploys the deployments. [games-check-scope.md](/docs/decisions/games-check-scope.md) explains why pnpm finds them on the runner.

## The base

`games-changes.yml` compares the checked-out commit with a base, and logs the base and both outputs.

| Event | Base |
| --- | --- |
| pull request | the first parent of the merge commit that GitHub checks out, which is the tip of the target branch |
| push or manual run | the commit before the push, as [deploys.md](/.github/docs/deploys.md#which-deployments-a-push-reaches) says |

## Packages

`pnpm/action-setup` installs the pnpm version that `packageManager` in `games/package.json` names. Then `pnpm --filter "...[<base>]"` in `games/` selects the packages with changed files and the packages that depend on them. pnpm reads only the workspace files and git, so nothing is installed first.

- pnpm ignores Markdown files and files in `games/platform/turn/`. `games/platform/turn/` has no package, so pnpm would count its files as a change to the root package. `check-turn.yml` checks it instead.
- pnpm counts any other file outside the packages, such as a file directly in `games/`, in `games/titles/` or `games/platform/` themselves, or in a removed package folder, as a change to the root package, and the workflow then makes every package affected.
- When pnpm fails, for example because the base is not in the history after a force push, every package is affected.

The `packages` output is `all`, empty, or the folders of the selected packages under `games/`, separated by spaces, such as `platform/p2p titles/tictactoe`.

## Deployments

When only some packages are affected, the `deployments` output holds those that have a `compose.yml`, and `games/platform/turn/` when a file there other than Markdown changes. When every package is affected, it holds every folder `games/*/*/` that has a `compose.yml`, the same depth that `check-project-names.yml`, `check-game-hosts.yml` and `image-scan.yml` read. It also holds every such folder that the change deletes, so that `deploy-project.yml` removes it from the VPS. A manual run, or a base that is not in the history, finds no deleted folders.
