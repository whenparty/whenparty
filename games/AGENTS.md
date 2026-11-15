# Games

`games/` is a [project](/docs/glossary.md#project) of [subprojects](/docs/glossary.md#subproject): the platform in `platform/`, each game in `titles/` and the page that lists the games in `index/`.

[platform/](platform/AGENTS.md) holds the platform that the games play through: the [modules](/docs/glossary.md#module) transport, rooms and netcode, each with its `AGENTS.md`, `docs/` and package in `platform/<name>/`, the p2p module, the platform's servers, and its decision records in `platform/docs/decisions/`. [titles/](titles/AGENTS.md) holds the games and lists them. [index/](index/AGENTS.md) holds the page at the root of `games.when.party` that lists them for players. [index-page-location.md](docs/decisions/index-page-location.md) explains why it lives in `index/`. [games-routing.md](/docs/decisions/games-routing.md) explains how nginx reaches the containers of `games/`, and [game-names-check.md](/docs/decisions/game-names-check.md) which names they keep. Read both before changing the name or network of a container here.

Each title and the index page need a [specification](/docs/conventions/specs.md). [platform/AGENTS.md](platform/AGENTS.md) says whether the platform needs one and which of its parts do.

Games own their rules and results. The platform owns connections, rooms, seats and matches.

## Verification

Run package scripts from `games/`. `pnpm --filter <package> test` runs one workspace's tests in Node, and `pnpm --filter <package> exec node --test --test-name-pattern '\b1-3 ' 'src/**/!(*.browser).test.{ts,mjs}'` only those of its requirement `1-3`; `pnpm test` and `pnpm typecheck` run the whole workspace. `pnpm test:browser` runs the browser tests of every package, as [browser-tests.md](docs/browser-tests.md) says, and [browser-tests.md](docs/decisions/browser-tests.md) in `docs/decisions/` explains why they are set up once at the root of the workspace and use local servers and, in CI, the runner's Chrome.

To run a title locally, start signaling with `pnpm --filter @whenparty/signaling start` and the title's dev script. [games-changes.md](/.github/docs/games-changes.md) says which packages a change checks and which [deployments](/docs/glossary.md#deployment) it redeploys, and [deploys.md](/.github/docs/deploys.md) how they deploy. [checks.md](/.github/docs/checks.md) says what else changes with the Node image of the Dockerfiles here. Compose files identify deployments. Deployment names share a namespace with `temp-sites/projects/`.
