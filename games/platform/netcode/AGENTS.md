# Netcode

`netcode/` is the netcode [module](/docs/glossary.md#module) of the [platform](../AGENTS.md), on the [rooms module](../rooms/AGENTS.md). It runs a game in a room: the host's page holds the game's state, seats players, runs matches and sends snapshots to the other pages, which send it their actions. The code of the package `@whenparty/netcode` for games runs only on the page. The package also exports, as `@whenparty/netcode/dev-headers`, the headers that the dev and preview servers of the titles send ([workspace.md](../../docs/workspace.md#running-a-title-locally)), which their Vite configs read in Node.

- [docs/specs/](docs/specs/): its specification.
- [layers.md](../docs/decisions/layers.md): why the platform is three modules in layers, and why netcode is a module on rooms. Read it before moving code or rules between the modules.
- [dev-headers.md](../../docs/decisions/dev-headers.md): why the dev headers are an export of this package. Read it before moving them.
