# Games

`games/` is a [project](/docs/glossary.md#project) of [subprojects](/docs/glossary.md#subproject): the platform in [`platform/`](platform/AGENTS.md), each game in [`titles/`](titles/AGENTS.md) and the page that lists the games in [`index/`](index/AGENTS.md). The platform owns connections, rooms, seats and matches, and each game owns its rules and results.

- [platform/AGENTS.md](platform/AGENTS.md): the platform that the games play through: the [modules](/docs/glossary.md#module) transport, rooms and netcode, each with its `AGENTS.md`, `docs/` and package in `platform/<name>/`, the platform's servers, and its decision records in `platform/docs/decisions/`.
- [titles/AGENTS.md](titles/AGENTS.md): the games, and the list of them.
- [index/AGENTS.md](index/AGENTS.md): the page at the root of `games.when.party` that lists the games for players.
- [docs/workspace.md](docs/workspace.md): the commands that install the workspace from the store on the machine and that test, typecheck and format the packages, how to run a title locally with the headers that the dev and preview servers of the titles send, the Vite setting that keeps the modulepreload polyfill out of the builds, and where the checks, images and deploys of `games/` are described.
- [docs/browser-tests.md](docs/browser-tests.md): how `pnpm test:browser` runs the browser tests, with which servers and browsers, what a test that opens pages needs, and how `tests/e2e.sh` runs the tests of the titles on the built images behind the proxy.
- [docs/decisions/browser-tests.md](docs/decisions/browser-tests.md): why the browser tests are set up once at the root of the workspace and use local servers and, in CI, the runner's Chrome, and why the tests of the titles also run on the built images behind the proxy before a deploy of `main`.
- [docs/decisions/dev-headers.md](docs/decisions/dev-headers.md): why the dev headers of the titles are an export of the netcode package. Read it before moving them.
- [docs/decisions/index-page-location.md](docs/decisions/index-page-location.md): why the index page lives in `index/`.
- [docs/decisions/pnpm-in-images.md](docs/decisions/pnpm-in-images.md): why the Dockerfiles here and `check-games.yml` take pnpm from `ghcr.io/pnpm/pnpm` instead of Corepack or npm. Read it before changing how they get pnpm or Node.
- [games-routing.md](/docs/decisions/games-routing.md): how nginx reaches the containers of `games/`. Read it before changing the name or network of a container here.
- [game-names-check.md](/docs/decisions/game-names-check.md): which names the containers of `games/` keep. Read it before changing the name or network of a container here.

Each title and the index page need a [specification](/docs/conventions/specs.md). [platform/AGENTS.md](platform/AGENTS.md) says whether the platform needs one and which of its parts do.
