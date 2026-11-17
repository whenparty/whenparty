# Platform

The platform lets the pages of a game find each other and play together. It is three [layers](AGENTS.md), each built only on the one below:

- **[transport](transport/AGENTS.md)** connects a page to the transport server and to other pages, directly or through the [TURN server](turn/AGENTS.md);
- **[rooms](rooms/AGENTS.md)** gathers the people of a game into [rooms](rooms/docs/specs/1-room.md) over those connections, lets the [owner](rooms/docs/specs/1-room.md) of a room decide who comes in, and brings a person's page back into the room after a break or a reload;
- **[netcode](netcode/AGENTS.md)** runs a game in a room: the [host's](netcode/docs/specs/2-page.md) page keeps the game state, and the other pages play through it.

The transport server, with the rooms server in it, runs in the [signaling server](signaling/AGENTS.md) at `signaling.when.party`, and the TURN server at `turn.when.party` is part of transport. [Calisthenics](../titles/calisthenics/AGENTS.md) plays through the [p2p module](p2p/AGENTS.md) instead.

## What each layer is made of

| Layer | Concept | What it is |
| --- | --- | --- |
| transport | [signaling connection](transport/docs/specs/1-signaling.md) | a page's WebSocket to the transport server |
| transport | [peer ID](transport/docs/specs/1-signaling.md) | the random name under which the transport server reaches a signaling connection; each new connection has a new one |
| transport | [peer connection](transport/docs/specs/3-connection.md) | a WebRTC connection between two pages, direct or through TURN |
| rooms | [room](rooms/docs/specs/1-room.md) | the participants of one game under one code |
| rooms | [owner](rooms/docs/specs/1-room.md) | the participant whose page created the room; the owner's page lets the others in |
| rooms | [participant](rooms/docs/specs/1-room.md) | a person in the room, the owner included, whose pages keep its number and token across reloads |
| rooms | [public number](rooms/docs/specs/1-room.md) | the number by which every page of the room knows a participant; the owner's is 1 |
| rooms | [token](rooms/docs/specs/1-room.md) | the secret with which a participant's page returns to the room |
| rooms | [term](rooms/docs/specs/4-owner.md) | the number of the owner's page: each new page of the owner that returns gets a higher one |
| netcode | [host](netcode/docs/specs/2-page.md) | the room's owner in the game; its page keeps the game state and judges actions |
| netcode | [seat](netcode/docs/specs/4-seats.md) | a player's place in the game, such as X or O |
| netcode | [spectators' queue](netcode/docs/specs/4-seats.md) | the participants without a seat, in the order in which they get seats that free up |
| netcode | [match](netcode/docs/specs/5-matches.md) | one round of a game, from its start on the host's page until it ends; a game can hold several matches, one after another |
| netcode | [snapshot](netcode/docs/specs/9-snapshots.md) | what the host's page holds about the game after a change, which it sends to the other pages |
| netcode | [action](netcode/docs/specs/8-actions.md) | a move of a player on a seat while a match runs; the host judges every action, its own included, and the other pages send theirs to it |
