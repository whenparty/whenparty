# Trystero Signaling Server

Signaling server for the peer-to-peer games on `*.when.party`, served at `wss://signaling.when.party`. Browsers use it only to find each other in a room and exchange WebRTC offers. Once they are connected, game state goes directly between the browsers and never reaches the server.

```
signaling:   browser → Cloudflare → nginx → Traefik → signaling ← … ← other browser
game state:  browser ⇄ WebRTC data channel ⇄ other browser
```

Trystero calls this kind of server a "ws-relay" (`@trystero-p2p/ws-relay`). Here it is called signaling, because in WebRTC "relay" means TURN: a server that forwards the game data itself when browsers can't reach each other directly. This server never sees game data.

## Using It in a Game

The games use it through [`@whenparty/p2p`](../p2p/README.md), which does this for them:

```js
import {joinRoom} from '@trystero-p2p/ws-relay'

const room = joinRoom(
  {appId: 'when.party/chess', relayConfig: {urls: ['wss://signaling.when.party']}},
  roomCode
)
```

- `appId`: use one per game, so rooms with the same code in different games never meet.
- `roomCode`: the room ID or short code the players share.
- Bundle Trystero into the game (`@trystero-p2p/ws-relay`, the same version as this server: a test in `platform/p2p` checks it) instead of loading it from a CDN. The `*.when.party` CSP (`infra/nginx/conf.d/temp-sites.conf`) allows scripts only from the site itself, and WebSocket connections only to the site itself and `wss://signaling.when.party`.
- State lives only in the open tabs. When the last player leaves, it is gone unless the game saves it itself (for example in `localStorage`).
- There is no TURN server yet. Players behind strict NAT (some mobile and corporate networks) may not be able to connect to each other.

## How It Works

- `src/server.mjs` runs one HTTP server on port 8080. `GET /health` returns `OK`. WebSocket upgrades go to `createWsRelayServer` from `@trystero-p2p/ws-relay/server`, a topic pub/sub that Trystero's ws-relay strategy talks to.
- `src/origin.mjs` accepts only browsers on `https://when.party`, `https://*.when.party`, `http://localhost[:port]` and `http://127.0.0.1[:port]`. Others get a 403. This stops other websites from using the server through their visitors' browsers. It is not a security boundary, because non-browser clients can send any `Origin`.
- The server pings every client every 30 s and drops the ones that did not answer the previous ping. That keeps idle sockets under nginx's 90 s `proxy_read_timeout` and Cloudflare's ~100 s WebSocket idle limit, and releases the subscriptions of dead connections.
- ws-relay's own limits apply: 1 MB per message, 128 subscriptions per socket, 10,000 in total.

## Local Development

From `games/`, the workspace root:

```bash
npm install
npm test --workspace platform/signaling
npm start --workspace platform/signaling
```

Or the production image, built from the `games/` context like every image in the workspace:

```bash
docker build -f platform/signaling/Dockerfile -t signaling:dev .
docker run --rm -p 8080:8080 signaling:dev
```

A game served from `http://localhost:<port>` can then use `relayConfig: {urls: ['ws://localhost:8080']}`.

The image installs only this package's dependencies from the workspace lockfile (`npm ci --omit=dev --workspace platform/signaling`).

## Updating Trystero

Change the exact version of `@trystero-p2p/ws-relay` in `package.json`, run `npm install` and `npm test` in `games/`, and move the games to the same version.

## Deployment

A push to `main` that changes this folder or the workspace lockfile builds `ghcr.io/whenparty/signaling` and restarts the container (see [../../README.md](../../README.md)). Players already in a game stay connected while it restarts: only new joins wait for it.
