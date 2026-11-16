# Platform

The platform lets the pages of a game find each other and play together. It is three layers, each built only on the one below:

- **transport** connects a page to the transport server and to other pages, directly or through the TURN server;
- **rooms** gathers the people of a game into rooms over those connections, lets the owner of a room decide who comes in, and brings a person's page back into the room after a break or a reload;
- **netcode** runs a game in a room: the host's page keeps the game state, and the other pages play through it.

The transport server, with the rooms server in it, runs in the signaling server at `signaling.when.party`, and the TURN server at `turn.when.party` is part of transport. Calisthenics plays through the p2p module instead.

## What each layer is made of

| Layer | Concept | What it is |
| --- | --- | --- |
| transport | signaling connection | a page's WebSocket to the transport server |
| transport | peer ID | the random name under which the transport server reaches a signaling connection; each new connection has a new one |
| transport | peer connection | a WebRTC connection between two pages, direct or through TURN |
| rooms | room | the participants of one game under one code |
| rooms | owner | the participant whose page created the room; the owner's page lets the others in |
| rooms | participant | a person in the room, the owner included, whose pages keep its number and token across reloads |
| rooms | public number | the number by which every page of the room knows a participant; the owner's is 1 |
| rooms | token | the secret with which a participant's page returns to the room |
| rooms | term | the number of the owner's page: each new page of the owner that returns gets a higher one |
| netcode | host | the room's owner in the game; its page keeps the game state and judges actions |
| netcode | seat | a player's place in the game, such as X or O |
| netcode | spectators' queue | the participants without a seat, in the order in which they get seats that free up |
| netcode | match | one round of a game, from its start on the host's page until it ends; a game can hold several matches, one after another |
| netcode | snapshot | what the host's page holds about the game after a change, which it sends to the other pages |
| netcode | action | a move of a player on a seat while a match runs; the host judges every action, its own included, and the other pages send theirs to it |
