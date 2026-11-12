# Index page location

## Context

The page at the root of `games.when.party` lists the games and links to them. It is a [deployment](/docs/glossary.md#deployment) of its own, with a `compose.yml`, and a package of the pnpm workspace, so that pnpm finds the changes that reach it, as [games-changes.md](/.github/docs/games-changes.md) says. Its folder name is its deployment name, which also names its image and container. Deployment names share a namespace with `temp-sites/projects/`, and `check-project-names.yml` fails on a clash, so a short name such as `index` is safe.

`games/` holds the platform in `platform/` and the games in `titles/`. Each game in `titles/` has an `appId`, as [titles/AGENTS.md](../../titles/AGENTS.md) says, and the path `/<name>/`, as [hosting.md](../../titles/docs/hosting.md) says. The platform consists of modules that the games rely on. `pnpm-workspace.yaml` lists the folders of packages.

`games-changes.yml` and `check-project-names.yml` find the deployments of `games/` by the folder depths of their `compose.yml`, and `image-scan.yml` scans their images. games-changes.md and [names.md](/temp-sites/docs/names.md) state those depths, so a deployment at a new depth changes all five files. The titles and the platform modules are two levels below `games/`.

## Options

- `games/titles/index`. The fewest changes, next to the games it lists. The rules of `titles/` would no longer hold for every folder there.
- `games/platform/index`. Two levels down, like the titles and the platform modules. The page is not a module that games rely on.
- A folder of its own that holds the page one level down, such as `games/site/index`. Two levels down, so no workflow changes. Every path and link to the page carries a level that holds one subproject.
- `games/index`. One level, next to `platform/` and `titles/`. The three workflows and two documents change to find deployments one level below `games/` too. Every `compose.yml` one level below `games/` then becomes a deployment. `pnpm-workspace.yaml` gets a line for it, as with any new folder of packages.

## Decision

`games/index`. The workflows change their pattern once, and no path carries a level that holds one subproject. Against `titles/` and `platform/`, the rules of those folders stay true for everything in them.

## Consequences

- [index/AGENTS.md](../../index/AGENTS.md), [games/AGENTS.md](../../AGENTS.md) and [pnpm-workspace.yaml](../../pnpm-workspace.yaml).
- [games-changes.yml](/.github/workflows/games-changes.yml), [check-project-names.yml](/.github/workflows/check-project-names.yml) and [image-scan.yml](/.github/workflows/image-scan.yml).
- [games-changes.md](/.github/docs/games-changes.md) and [names.md](/temp-sites/docs/names.md).
