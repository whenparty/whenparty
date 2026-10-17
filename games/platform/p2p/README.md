# P2P

The client platform every game in `games/titles/` builds on (`@whenparty/p2p`). It finds the other players through the signaling server, keeps the room state in the host's browser and syncs it to everyone over WebRTC data channels ([Trystero](https://github.com/dmotz/trystero)). Nothing is stored on a server.

It is a library, not a deployed project: it has no `compose.yml`. A change here redeploys every title.

## Using It in a Game

```ts
import {createRoomCode, startSession, type GameRules} from '@whenparty/p2p'

const rules: GameRules<MyState, MyMove> = {...}

const session = startSession({
  appId: 'when.party/my-game',
  code: createRoomCode(),
  isHost: true,
  rules,
  onChange: view => render(view)
})

session.send({type: 'move', move})
session.send({type: 'restart'})
await session.leave()
```

- `appId`: one per game, so the same code in another game is a different room.
- `rules`: pure functions over plain JSON state and moves. `isState` and `isMove` must reject anything else, because they guard what comes over the wire.
- `onChange` gets a `SessionView`: this tab's peer ID, whether it is the host, the latest room state (seats and game, or `null` until a guest hears from the host), and whether the host has left.
- `seatOf(room, peerId)` and `isFull(room)` help the page decide what to show.
- `titles/tictactoe/` is the working example.

## Room Codes

`src/room-code.ts` makes 5-character codes from `23456789BCDFGHJKMNPQRSTVWXYZ`. The alphabet has no `0`/`O`, `1`/`I`/`L` and no vowels, so codes are hard to misread and never spell words. That gives about 17 million codes. `normalizeRoomCode` accepts any case, spaces and dashes. The code is the Trystero `roomId`.

## Sync Model: the Host Decides

The browser that created the room is the **host**. It is the only one that changes the state.

- The host keeps the room state: who sits in which seat, and the game. It runs every event (a peer joins, a peer leaves, a player asks to move or restart) through the pure functions in `src/room-state.ts`, then broadcasts the whole new state to every peer (the `snapshot` action).
- Guests never change the state themselves. They send what they want to do to the host (the `intent` action) and show the snapshots they get back. The host drops illegal intents: moves the rules reject, spectators, or a room that is not full yet.
- **Seats** are filled in join order, the host first. Anyone after that watches. A rematch is allowed once the game is over.
- **Late joiners**: the host broadcasts the state whenever a peer joins, so a newcomer gets it at once. A free seat goes to the next peer that joins, with the game as it was. That is how a guest who reloads the page (and gets a new peer ID) gets back in.
- **The game ends when the host leaves.** The state lived only in the host's tab. A guest's view then has `hostLeft: true`. Every peer already holds the latest snapshot, so host migration (for example, the remaining peer with the lowest ID becomes the host) can be added in `src/session.ts`.
- **Topology**: logically a star. Guests talk only to the host, by its peer ID, and accept snapshots only from it. Trystero still connects every peer in a room to every other one, but nothing here relies on guest-to-guest links. Relaying messages through another player can build on this.
- **Trust**: anyone with the code can join and send anything, so the host checks the shape of every intent before running the rules, and guests check the shape of every snapshot (`src/protocol.ts`). Guests trust the host's decisions.

Messages are JSON strings. Snapshots are small, so sending the whole state is simpler than sending changes.

## Signaling Server

`src/signaling-url.ts` picks `wss://signaling.when.party` (`games/platform/signaling`), or `ws://localhost:8080` for pages on `localhost` and `127.0.0.1`. A test checks that this package and the signaling server use the same `@trystero-p2p/ws-relay` version.

## Dev Server Headers

`src/dev-headers.ts` (`@whenparty/p2p/dev-headers`) holds the production `Content-Security-Policy` and `Permissions-Policy` from `infra/nginx/conf.d/`, plus the local signaling server. Titles send them from the Vite dev and preview servers, so a script from a CDN or a connection to another server fails locally the same way it would in production. Keep them in sync when the nginx headers change.

## Code Layout

```
src/
  index.ts           # the public API
  room-code.ts       # make and check room codes
  room-state.ts      # GameRules interface; seats, joins, leaves and intents (pure)
  protocol.ts        # encode and check what goes over the wire (pure)
  session.ts         # Trystero: runs the host or a guest, calls onChange with each new view
  signaling-url.ts   # which signaling server to use
  dev-headers.ts     # production headers for the Vite dev servers
  tests/             # node:test, with a tiny test game (race.ts)
```

`session.ts` needs WebRTC, so it is covered by the two-tab check in the title READMEs rather than by unit tests.

## Limits

- There is no TURN server yet. Players behind strict NAT (some mobile and corporate networks) may never connect to each other.
- Data channels only. `Permissions-Policy` blocks camera and microphone on every `*.when.party` site.
