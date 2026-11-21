# Limit on TURN credentials

## Context

The [TURN server](../../turn/AGENTS.md), coturn, relays the traffic of pages that cannot connect directly. It accepts any credentials made with its secret until they expire (`8-2` of [8-turn.md](../../transport/docs/specs/8-turn.md)), so whoever gets credentials can use it as a relay. Its quotas in [turnserver.conf](../../turn/turnserver.conf) bound that use ([deployment.md](../../turn/docs/deployment.md#constraints)): 64,000 bytes a second for each allocation and 8,000,000 in all, so at most 125 allocations at once, and at most 32 for one username.

The [transport server](../../transport/AGENTS.md) gives the credentials, over a page's signaling connection, and does not know who the client is. It gives new ones before each connection attempt (`3-4` of [3-connection.md](../../transport/docs/specs/3-connection.md), `8-1` of [8-turn.md](../../transport/docs/specs/8-turn.md)), so each side of each connection has a username of its own.

nginx limits the connections and requests of each client address to the signaling deployment (`2-4` of [2-headers.md](/infra/docs/specs/2-headers.md)). The players of one party often share an address, such as one Wi-Fi or a mobile carrier's NAT, as [games-conf.md](/infra/docs/games-conf.md) says, and one client with IPv6 can use many addresses.

## Options

- A limit for each signaling connection, such as three credentials in 12 hours. It stops a loop of requests over one connection. A client opens another connection, within the limits of nginx, and a page that makes many attempts, such as a host whose participants return after a reload, runs out and connects without TURN.
- A limit for each client address. It bounds a client across its connections. It must fit a whole party behind one address, so it hardly bounds one client, and a client with many IPv6 addresses passes it.
- No limit. The simplest. One client can take every allocation of coturn within its quotas, and the peer connections that need TURN then close with `no relay` (`3-9` of [3-connection.md](../../transport/docs/specs/3-connection.md)).

## Decision

No limit. A client gets around a limit for each connection by opening another one, and a page that makes many attempts runs out of it; a limit for each address refuses a party behind one address or lets a client with many IPv6 addresses through. coturn's quotas already bound what any client can take: at most 125 allocations, after which only the connections that need TURN fail.

## Consequences

- The transport specification: `3-4` of [3-connection.md](../../transport/docs/specs/3-connection.md) and `8-1` of [8-turn.md](../../transport/docs/specs/8-turn.md).
