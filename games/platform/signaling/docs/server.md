# The signaling server

## Code and origins

[src/main.mjs](../src/main.mjs) starts the server on the port in `PORT`, 8080 by default, with the [rooms server](../../rooms/AGENTS.md) and the TURN settings of the environment. [src/server.mjs](../src/server.mjs) owns HTTP, the [relay's](relay.md) WebSockets with their heartbeat and resource limits, and the `ws` server that completes the upgrades the [transport server](../../transport/AGENTS.md) accepts, as [websocket-library.md](../../docs/decisions/websocket-library.md) explains. [src/origin.mjs](../src/origin.mjs) defines the origins that the relay and `GET /turn-credentials` allow. The transport server keeps its own list (`7-6` of [7-server.md](../../transport/docs/specs/7-server.md)), and the two stay apart while [p2p](../../p2p/AGENTS.md) is in use. Origin filtering restricts browser use; it does not authenticate clients.

## HTTP

`GET /health` is the container health check. `GET /turn-credentials` returns uncached credentials, which only p2p uses, to every request from an allowed origin, or, when TURN is disabled, 404 with the same CORS headers, so that p2p reads it and connects without TURN. [src/turn.mjs](../src/turn.mjs) makes them in the format and with the lifetime of `8-2` in [8-turn.md](../../transport/docs/specs/8-turn.md), without a limit, as [turn-credentials-limit.md](../../docs/decisions/turn-credentials-limit.md) explains. Signaling shares its TURN secret with coturn, as [deployment.md](../../turn/docs/deployment.md) of the TURN deployment says. Keep secrets on the server.

## Intervals and limits

The relay pings its clients every 30 seconds ([relay.md](relay.md)), and the transport server checks its signaling connections every 15 seconds (`7-2` of [7-server.md](../../transport/docs/specs/7-server.md)). Keep both intervals below the idle timeouts of the proxy, such as the 90 seconds of requirement `2-5` in the proxy's [2-headers.md](/infra/docs/specs/2-headers.md). Keep the separate limits of signaling in [games.conf](/infra/nginx/conf.d/games.conf), which [games-conf.md](/infra/docs/games-conf.md) explains.

## Tests

`pnpm --filter @whenparty/signaling test` from `games/` runs the [tests](../src/tests/). They cover allowed origins, HTTP responses, the relay's WebSocket limits, heartbeat and credentials, and the hand-over of upgrades at `/platform` (`1-13` of [1-signaling.md](../../transport/docs/specs/1-signaling.md)) to the transport server and its rooms server. After a change to the dependencies of signaling, also run `pnpm test` and `pnpm typecheck` from `games/` ([workspace.md](../../../docs/workspace.md#checks)).

## Image and deploys

Each deploy restarts signaling and so ends every room of the rooms module (`10-1` of [10-server-room.md](../../rooms/docs/specs/10-server-room.md)), as [room-storage.md](../../docs/decisions/room-storage.md) explains. The [Dockerfile](../Dockerfile) uses `games/` as its build context. [compose.yml](../compose.yml) defines the production settings; [deploys.md](/.github/docs/deploys.md#deploy-projectyml) says how it deploys, and [games-changes.md](/.github/docs/games-changes.md) which changes redeploy it, changes to the transport and rooms packages included.
