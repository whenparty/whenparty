# Platform

`platform/` is the [subproject](/docs/glossary.md#subproject) of `games/` that the games play through. Three of its [modules](/docs/glossary.md#module) form layers, each relying only on the layer below: transport connects pages, rooms gathers them into rooms, and netcode runs a game in a room. [Calisthenics](../titles/calisthenics/AGENTS.md) plays through the p2p module instead. The platform's servers run in two [deployments](/docs/glossary.md#deployment), signaling and turn, which are not modules of their own; `turn/` belongs to transport.

- [transport/AGENTS.md](transport/AGENTS.md): the transport module, which also spans `turn/`.
- [rooms/AGENTS.md](rooms/AGENTS.md): the rooms module, on transport.
- [netcode/AGENTS.md](netcode/AGENTS.md): the netcode module, on rooms, which [tictactoe](../titles/tictactoe/AGENTS.md) plays through.
- [p2p/AGENTS.md](p2p/AGENTS.md): the p2p module and its session rules.
- [signaling/AGENTS.md](signaling/AGENTS.md): the deployment at `signaling.when.party`, which runs the transport server, with the rooms server in it, and the relay of p2p.
- [turn/AGENTS.md](turn/AGENTS.md): the deployment of coturn at `turn.when.party`, part of the transport module.
- [docs/decisions/layers.md](docs/decisions/layers.md): why the platform is these three modules and why its servers run in deployments that are not modules of their own. Read it before moving code or rules between the modules.
- [docs/decisions/room-storage.md](docs/decisions/room-storage.md): why rooms live only in the memory of the rooms server.
- [docs/decisions/turn-credentials-limit.md](docs/decisions/turn-credentials-limit.md): why the platform gives TURN credentials without a limit.
- [docs/decisions/websocket-library.md](docs/decisions/websocket-library.md): why the signaling deployment, not the transport package, depends on `ws` and completes the upgrades that the transport server accepts.
- [hosting.md](../titles/docs/hosting.md): the storage keys of the platform and of the titles, which share one origin. Read it before the platform stores anything in the browser.

The transport, rooms and netcode modules need a [specification](/docs/conventions/specs.md). The platform itself, the p2p module and the code in `signaling/` need none.
