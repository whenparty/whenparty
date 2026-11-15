# Platform layers

## Context

The games in `games/titles/` play through the platform in `games/platform/`. A page of a game needs a connection to a server and connections to other pages, a room that lets participants in and tells who is present, and a game state that the participants share. Voice and video calls between pages, which the platform is expected to carry later, need the same connections and rooms but no game state.

Pages reach two servers. The signaling server at `signaling.when.party` passes messages between pages that are not connected yet. The TURN server, coturn at `turn.when.party`, relays the traffic of pages that cannot connect directly; it needs a container of its own on the host network, with its own UDP ports, as [turn/AGENTS.md](../../turn/AGENTS.md) says. Each runs as a [deployment](/docs/glossary.md#deployment) of its own.

How pages connect changes with browsers, WebRTC and coturn. Who may join a room, and how long a room waits for someone, change with the needs of each game and of calls. Libraries that give rooms over connections keep rooms as a layer above them, such as Socket.IO, Phoenix, Jitsi and Colyseus, or make the room the interface of one package that hides the connections, such as Trystero and LiveKit.

`check-games.yml` selects the packages that [games-changes.md](/.github/docs/games-changes.md) finds by their folders, and pnpm's filter by folder also selects every package below that folder.

## Options

- One module for connections, rooms and game state, as the p2p module is. The fewest documents and boundaries. A change to how pages connect touches the code, specification and tests of the game state, and calls would carry that code.
- The previous decision: the modules p2p, signaling and turn, each with a specification of what the others rely on, such as the signaling protocol and the format of TURN credentials. Each deployment is a module of its own. The rules of one connection are split between the module on the page and the modules of the servers, and calls would rely on p2p, a module of the games, for their connections.
- One module for connections and rooms, with rooms as its interface, and netcode over it, as in Trystero and LiveKit. One specification less and no boundary between connections and rooms. A change for browsers and a change to who may join a room meet in one module, and the rules of rooms can be tested only together with the connections.
- Rooms as an option of a module of connections. Calls without rooms could use the connections alone. Every rule of the module holds a condition on whether rooms are on, while every known use, games and calls, turns them on.
- Transport and rooms as modules, and netcode as the platform's specification, not a module. Fewer documents: netcode has no `AGENTS.md` of its own, and its specification is the platform's. That specification lies in `games/platform/docs/specs/`, away from the package that holds netcode's code and tests, unlike those of transport and rooms.
- `games/platform/` itself as one package that holds netcode, with the packages of the other modules inside it. Netcode's code lies next to the platform's specification. A change to netcode would select the platform's folder, and with it every package of the platform for the checks, and the platform's folder would mix netcode's files with the folders of the other modules.
- Three modules in layers: transport, rooms on transport and netcode on rooms, each with its own `AGENTS.md`, specification and package, and each relying only on the module below. The transport server, with the rooms server in it, runs in the signaling deployment, and coturn is part of transport. Calls can use transport and rooms without netcode. Two boundaries to keep, and three specifications in place of one.

## Decision

Three modules in layers. Calls and games share connections and rooms but not the game state, and a module that relies only on the one below can be used without the modules above it. Transport changes with browsers, WebRTC and coturn, and rooms with the needs of games and calls, so each changes and is tested on its own. The rules of one connection, on the page and on its server, stay in one specification, and a deployment only runs servers, such as coturn in the container it needs. As a module, netcode keeps its code, specification and tests together, like the other two, and the platform needs no specification of its own.

## Consequences

- [platform/AGENTS.md](../../AGENTS.md) lists the modules and deployments and says which parts need a specification.
- [transport/AGENTS.md](../../transport/AGENTS.md), [rooms/AGENTS.md](../../rooms/AGENTS.md) and [netcode/AGENTS.md](../../netcode/AGENTS.md) map each module, and [signaling/AGENTS.md](../../signaling/AGENTS.md) says which servers the signaling deployment runs.
