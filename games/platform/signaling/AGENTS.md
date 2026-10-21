# Signaling

The service at `signaling.when.party` handles peer discovery and WebRTC negotiation. Games connect through [P2P](../p2p/AGENTS.md).

[src/server.mjs](src/server.mjs) owns HTTP, WebSockets, heartbeat and resource limits. [src/origin.mjs](src/origin.mjs) defines allowed origins. Keep heartbeat below proxy idle timeouts and retain the separate signaling limits in [nginx](../../../infra/nginx/conf.d/temp-sites.conf). Origin filtering restricts browser use; it does not authenticate clients.

`GET /health` is the container health check. `GET /turn-credentials` returns uncached credentials for allowed origins, or 404 when TURN is disabled. [src/turn.mjs](src/turn.mjs) defines their format and lifetime; follow the [TURN instructions](../turn/AGENTS.md) for shared configuration. Keep secrets on the server.

Keep `@trystero-p2p/ws-relay` pinned to the same version here and in P2P. Update both manifests and the workspace lockfile together.

## Verification

Run `npm test --workspace platform/signaling` from `games/`. [Tests](src/tests/) cover allowed origins, HTTP responses, WebSocket limits, heartbeat and credentials. Dependency updates also require the full workspace tests and typecheck.

Start locally with `npm start --workspace platform/signaling`; P2P uses `ws://localhost:8080`. The [Dockerfile](Dockerfile) uses `games/` as its build context. [compose.yml](compose.yml) defines production settings; shared deployment rules are in [games/AGENTS.md](../../AGENTS.md).
