# The signaling server

## Code

[src/main.mjs](../src/main.mjs) starts the server on the port in `PORT`, 8080 by default, with the [rooms server](../../rooms/AGENTS.md) and the TURN secret in `TURN_SECRET`, without which the [transport server](../../transport/AGENTS.md) gives no TURN credentials (`8-1` of [8-turn.md](../../transport/docs/specs/8-turn.md)). [src/server.mjs](../src/server.mjs) owns HTTP and the `ws` server that completes the upgrades the transport server accepts, as [websocket-library.md](../../docs/decisions/websocket-library.md) explains.

## HTTP

`GET /health` is the container health check. Every other request, a WebSocket upgrade at a path other than `/platform` included, answers 404. Signaling shares its TURN secret with coturn, as [deployment.md](../../turn/docs/deployment.md) of the TURN deployment says. Keep secrets on the server.

## Intervals and limits

The transport server checks its signaling connections every 15 seconds (`7-2` of [7-server.md](../../transport/docs/specs/7-server.md)). Keep that interval below the idle timeouts of the proxy, such as the 90 seconds of requirement `2-5` in the proxy's [2-headers.md](/infra/docs/specs/2-headers.md). Keep the separate limits of signaling in [games.conf](/infra/nginx/conf.d/games.conf), which [games-conf.md](/infra/docs/games-conf.md) explains.

## Tests

`pnpm --filter @whenparty/signaling test` from `games/` runs the [tests](../src/tests/). They cover the HTTP responses, the refusal of upgrades at other paths, and the hand-over of upgrades at `/platform` (`1-13` of [1-signaling.md](../../transport/docs/specs/1-signaling.md)) to the transport server and its rooms server. After a change to the dependencies of signaling, also run `pnpm test` and `pnpm typecheck` from `games/` ([workspace.md](../../../docs/workspace.md#checks)).

## Image and deploys

Each deploy restarts signaling and so ends every room of the rooms module (`10-1` of [10-server-room.md](../../rooms/docs/specs/10-server-room.md)), as [room-storage.md](../../docs/decisions/room-storage.md) explains. The [Dockerfile](../Dockerfile) uses `games/` as its build context. [compose.yml](../compose.yml) defines the production settings; [deploys.md](/.github/docs/deploys.md#deploy-projectyml) says how it deploys, and [games-changes.md](/.github/docs/games-changes.md) which changes redeploy it, changes to the transport and rooms packages included.
