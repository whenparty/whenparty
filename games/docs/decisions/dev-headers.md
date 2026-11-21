# Place of the dev headers

## Context

The dev and preview servers of every title send the headers of the proxy, as [workspace.md](../workspace.md#running-a-title-locally) says, so the `vite.config.ts` of each title imports one shared constant. An edit of it follows every change of the games' Content-Security-Policy in [games.conf](/infra/nginx/conf.d/games.conf) and changes nothing in production.

[code.md](/docs/conventions/code.md) puts a helper that two folders use in the closest folder that both may import from. Each title is a package of the [workspace](../workspace.md) and imports the code of other packages only through the packages it depends on, so the folders that both titles may import from are the packages they share.

[games-changes.md](/.github/docs/games-changes.md) counts a file outside every package, such as one directly in `games/titles/`, as a change to the root package, which makes every package and [deployment](/docs/glossary.md#deployment) of `games/` affected, signaling included. A deploy of signaling ends every room ([room-storage.md](../../platform/docs/decisions/room-storage.md)). A file in a package reaches only that package and the packages that depend on it. Every title depends on `@whenparty/netcode`, and signaling does not.

## Options

- The previous decision: an export of the p2p package, on which only the titles depended. It goes away with that package.
- `games/titles/dev-headers.ts`, a file outside every package that both titles reach by a relative path. No package changes. Each edit redeploys every deployment of `games/` and ends every room in play, and each title's Dockerfile copies the file on its own.
- An export of `@whenparty/netcode`, `@whenparty/netcode/dev-headers`, the package that both titles share. An edit reaches netcode and the titles. The package of a module holds a constant that serves local development, not its specification.
- A package of its own for the constant. An edit reaches only the titles. One more package, with its `package.json`, lockfile entry and line in each title's Dockerfile, for one constant.

## Decision

An export of `@whenparty/netcode`, the closest place that both titles may import from. An edit of the headers ends no room, which `games/titles/` cannot give, and the constant asks nothing of netcode's specification or tests, so it costs less than a package of its own.

## Consequences

- [netcode/package.json](../../platform/netcode/package.json) and [dev-headers.ts](../../platform/netcode/src/dev-headers.ts).
- The `vite.config.ts` of [tictactoe](../../titles/tictactoe/vite.config.ts) and [calisthenics](../../titles/calisthenics/vite.config.ts), and their Dockerfiles, which copy `platform/netcode/`.
