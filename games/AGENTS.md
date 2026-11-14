# Games

`games/` is a [project](/docs/glossary.md#project) of [subprojects](/docs/glossary.md#subproject): the platform in `platform/`, each game in `titles/` and the page that lists the games in `index/`. The platform consists of three [modules](/docs/glossary.md#module):

- [platform/p2p](platform/p2p/AGENTS.md) owns browser connections and room state.
- [platform/signaling](platform/signaling/AGENTS.md) discovers peers and issues TURN credentials.
- [platform/turn](platform/turn/AGENTS.md) relays WebRTC traffic when direct connections fail.

[titles/](titles/AGENTS.md) holds the games and lists them. [index/](index/AGENTS.md) holds the page at the root of `games.when.party` that lists them for players. [index-page-location.md](docs/decisions/index-page-location.md) explains why it lives in `index/`. [games-routing.md](/docs/decisions/games-routing.md) explains how nginx reaches the containers of `games/`, and [game-names-check.md](/docs/decisions/game-names-check.md) which names they keep. Read both before changing the name or network of a container here.

The platform, each of its modules, each title and the index page need a [specification](/docs/conventions/specs.md).

Games own match rules and results. Shared platform code owns transport and participant lifecycle.

## Verification

Run package scripts from `games/`. `pnpm --filter <package> test` runs one workspace's tests; `pnpm test` and `pnpm typecheck` run the whole workspace.

To run a title locally, start signaling with `pnpm --filter @whenparty/signaling start` and the title's dev script. [games-changes.md](/.github/docs/games-changes.md) says which packages a change checks and which [deployments](/docs/glossary.md#deployment) it redeploys, and [deploys.md](/.github/docs/deploys.md) how they deploy. [checks.md](/.github/docs/checks.md) says what else changes with the Node image of the Dockerfiles here. Compose files identify deployments. Deployment names share a namespace with `temp-sites/projects/`.
