# WebSocket library of the transport server

## Context

The [transport server](../../transport/AGENTS.md) accepts the signaling connections of pages as WebSocket connections at `/platform` (`1-13` of [1-signaling.md](../../transport/docs/specs/1-signaling.md)). It runs in the [signaling deployment](../../signaling/AGENTS.md), as [layers.md](layers.md) decides, and the deployment also runs the [relay](../../signaling/docs/relay.md) of [p2p](../../p2p/AGENTS.md) through `@trystero-p2p/ws-relay`. Node has no WebSocket server of its own.

`ws` 8.22.0 is already in the workspace lockfile: `@trystero-p2p/ws-relay` depends on it, and the tests of signaling use it. pnpm lets a package import only its own dependencies, so signaling cannot import the `ws` that the relay depends on. The relay leaves the deployment, and its `ws` with it, when no title plays through p2p.

A title that plays through [netcode](../../netcode/AGENTS.md), such as [tictactoe](../../../titles/tictactoe/AGENTS.md), depends on `@whenparty/transport` through netcode and [rooms](../../rooms/AGENTS.md), so the build stage of its image installs the dependencies of transport. The image it serves holds only the built pages, which never import the transport server.

`ws` takes messages of up to 100 MiB unless its server sets a lower `maxPayload`.

## Options

- `ws` in the dependencies of signaling. Signaling creates the WebSocket server for `/platform` and completes the upgrades that the transport server accepts; the transport server works on any socket that has the methods it uses. Transport, which the pages import, has no dependency, and its tests run on a fake socket. Its drawback: the limit of 65,536 bytes per message of `7-4` in [7-server.md](../../transport/docs/specs/7-server.md) is set in signaling as well as checked by transport.
- `ws` in the dependencies of `@whenparty/transport`. The transport server accepts its WebSockets itself, and signaling only hands it the upgrades, so all of the server's WebSocket code and its limit are in one package. The package that the pages import gets a dependency that only its server uses, and the build stage of every title that plays through netcode installs it.
- A WebSocket server of its own on `node:http`. No dependency, but frames, masks, fragments, pings and the closing handshake are code to write and test, in a parser that faces the internet.

## Decision

`ws` in the dependencies of signaling. Transport keeps no dependency that the pages do not use, and the cost is one limit set in two places, which a test of signaling checks.

## Consequences

- [signaling/package.json](../../signaling/package.json) and [signaling/src/server.mjs](../../signaling/src/server.mjs).
- [transport/src/server/api.ts](../../transport/src/server/api.ts): the socket and the upgrade that the transport server takes.
- [signaling/AGENTS.md](../../signaling/AGENTS.md) and [transport/AGENTS.md](../../transport/AGENTS.md) say what signaling does with the upgrades.
