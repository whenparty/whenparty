# Netcode

`netcode/` is the netcode [module](/docs/glossary.md#module) of the [platform](../AGENTS.md), on the [rooms module](../rooms/AGENTS.md). It runs a game in a room: the host's page holds the game's state, seats players, runs matches and sends snapshots to the other pages, which send it their actions. The package `@whenparty/netcode` runs only on the page.

- [docs/specs/](docs/specs/): its specification.
- [layers.md](../docs/decisions/layers.md): why the platform is three modules in layers, and why netcode is a module on rooms. Read it before moving code or rules between the modules.
