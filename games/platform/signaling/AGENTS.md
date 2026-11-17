# Signaling

`signaling/` is the [deployment](/docs/glossary.md#deployment) of the [platform](../AGENTS.md) at `signaling.when.party`, not a [module](/docs/glossary.md#module). It runs the relay through which the [p2p module](../p2p/AGENTS.md) finds peers and negotiates WebRTC, and gives p2p its TURN credentials at `GET /turn-credentials`. It also runs the transport server of the [transport module](../transport/AGENTS.md), with the rooms server of the [rooms module](../rooms/AGENTS.md) in it. It hands WebSocket upgrade requests to the transport server, which decides itself which to accept by their path, `/platform` (`1-13` of [1-signaling.md](../transport/docs/specs/1-signaling.md)), and their origin (`7-6` of [7-server.md](../transport/docs/specs/7-server.md)). Signaling gives the requests at other paths to the relay.

- [docs/server.md](docs/server.md): what `src/` holds, the origins that signaling allows, its HTTP endpoints, how its intervals and limits fit the proxy, its tests, and its image and deploys. Read it before changing `src/`.
- [docs/relay.md](docs/relay.md): the relay's limits and heartbeat. Read it before changing them.
- [websocket-library.md](../docs/decisions/websocket-library.md): why signaling, not the transport package, depends on `ws` and completes the upgrades that the transport server accepts.
- [turn-credentials-limit.md](../docs/decisions/turn-credentials-limit.md): why `GET /turn-credentials` gives credentials without a limit.
- [room-storage.md](../docs/decisions/room-storage.md): why each deploy of signaling ends every room of the rooms module.
