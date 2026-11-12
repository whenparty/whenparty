# Signaling server

- `7-1` The signaling server, the [deployment](/docs/glossary.md#deployment) in [`games/platform/signaling/`](../../signaling/AGENTS.md), runs the transport server and the rooms server. It serves them at `wss://signaling.when.party/platform`. It accepts a WebSocket connection only from a page whose origin is `https://when.party`, `https://` with a host that ends in `.when.party`, or `http://localhost` or `http://127.0.0.1`, each with any port or none. It refuses a connection that names no origin.
- `7-2` When 5000 WebSocket connections are open, the signaling server refuses the next one.
- `7-3` Each WebSocket connection starts with 200 messages to spend and regains them at 20 a second, up to 200. When a page sends a WebSocket message with less than one left, the signaling server closes its connection.
- `7-4` When a page sends a WebSocket message over 65,536 bytes, or one that the signaling server cannot read, the server closes its connection.
- `7-5` The signaling server checks each WebSocket connection every 30 seconds and closes one that did not answer the previous check.
