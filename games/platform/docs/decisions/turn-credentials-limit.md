# Limit on TURN credentials

## Context

The [TURN server](../../turn/AGENTS.md), coturn, relays the traffic of pages that cannot connect directly. It accepts any credentials made with its secret until they expire (`8-2` of [8-turn.md](../../transport/docs/specs/8-turn.md)), so whoever gets credentials can use it as a relay. Its quotas in [turnserver.conf](../../turn/turnserver.conf) bound that use ([deployment.md](../../turn/docs/deployment.md#constraints)): 64,000 bytes a second for each allocation and 8,000,000 in all, so at most 125 allocations at once, and at most 32 for one username.

Two addresses give credentials, and neither knows who the client is:

- the [transport server](../../transport/AGENTS.md), over a page's signaling connection, gives new ones before each connection attempt (`3-4` of [3-connection.md](../../transport/docs/specs/3-connection.md), `8-1` of [8-turn.md](../../transport/docs/specs/8-turn.md)), so each side of each connection has a username of its own;
- [`GET /turn-credentials`](../../signaling/docs/server.md#http) of the [signaling deployment](../../signaling/AGENTS.md), which the [p2p module](../../p2p/AGENTS.md) uses, gives them to every request from an allowed origin, and a client outside a browser can name any origin.

nginx limits the connections and requests of each client address to the signaling deployment (`2-4` of [2-headers.md](/infra/docs/specs/2-headers.md)). The players of one party often share an address, such as one Wi-Fi or a mobile carrier's NAT, as [games-conf.md](/infra/docs/games-conf.md) says, and one client with IPv6 can use many addresses.

## Options

- A limit for each signaling connection, such as three credentials in 12 hours. It stops a loop of requests over one connection. A client opens another connection, within the limits of nginx; a page that makes many attempts, such as a host whose participants return after a reload, runs out and connects without TURN; and `GET /turn-credentials` still gives credentials without the limit.
- A limit for each client address, on both addresses. It bounds a client across its connections. It must fit a whole party behind one address, so it hardly bounds one client; it needs a count that the transport server and `GET /turn-credentials` share; and a client with many IPv6 addresses passes it.
- A tighter limit on `GET /turn-credentials` in nginx alone. It needs no code. A client takes credentials from the transport server instead, and a party behind one address can be refused.
- No limit on either address. The simplest. One client can take every allocation of coturn within its quotas, and the peer connections that need TURN then close with `no relay` (`3-9` of [3-connection.md](../../transport/docs/specs/3-connection.md)).

## Decision

No limit. Each limit leaves a way around it while the other address gives credentials, or refuses a party behind one address, while coturn's quotas already bound what any client can take: at most 125 allocations, after which only the connections that need TURN fail.

## Consequences

- The transport specification: `3-4` of [3-connection.md](../../transport/docs/specs/3-connection.md) and `8-1` of [8-turn.md](../../transport/docs/specs/8-turn.md).
- [server.md](../../signaling/docs/server.md) of the signaling deployment describes `GET /turn-credentials`.
