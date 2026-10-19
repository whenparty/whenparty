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
- `onChange` gets a `SessionView`: this tab's peer ID, whether it hosts the room right now (that changes when a host leaves), the latest room state (members, seats and game, or `null` until a guest hears from a host), whether the host is being replaced (`switchingHost`), whether nobody could take over (`hostLeft`), and whether the signaling server found a peer in the room that this tab could not connect to (`unreachable`).
- `session.isSignalingOpen()` tells whether this tab reaches the signaling server right now. It has no event, so a page that waits for its room asks it again from time to time. With it and `unreachable`, the page can tell a wrong code (nobody answers) from a dead signaling connection and from a network that blocks direct connections.
- `rejoinAsHost`, for a guest: this tab hosted the room before it reloaded. If it neither hears from a host nor meets a peer within twice `takeoverDelayMs`, it hosts the room again, with a new game. Without it, a host alone in its room would come back as a guest that waits for a host forever. `titles/tictactoe/` keeps the hosted code in `sessionStorage` for this.
- `takeoverDelayMs` (default 2500) is how long the next member waits before it takes over from a host whose link dropped. A host waits twice as long before it drops a member whose link dropped.
- `awayHoldMs` (default 2 minutes) is how long the room holds the place and seat of a member that stepped away. A page that gets hidden (minimized, another tab or app, the screen off) tells the others (the `away` action) and stays in the room as it is: on a computer it keeps running. A phone soon freezes a hidden page and its links drop. The host then waits `awayHoldMs` instead of twice `takeoverDelayMs` before it drops that member, so a player who comes back within it finds its seat. The page says when it is shown again, and tells every peer that joins whether it is hidden, since a word sent while its links were down is lost.
- `rules.onSeatLeft(state, seat)`, optional, runs when a seated player leaves, the host included, for example to skip their turn or end the game. Then the seat goes to the first member without one.
- `seatOf(room, peerId)` and `isFull(room)` help the page decide what to show.
- `titles/tictactoe/` is the working example.

## Room Codes

`src/room-code.ts` makes 5-character codes from `23456789BCDFGHJKMNPQRSTVWXYZ`. The alphabet has no `0`/`O`, `1`/`I`/`L` and no vowels, so codes are hard to misread and never spell words. That gives about 17 million codes. `normalizeRoomCode` accepts any case, spaces and dashes, and `roomCodeFromHash` reads the code from an invite link (`#K7MXQ`). The code is the Trystero `roomId`.

## Sync Model: the Host Decides

The browser that created the room is the first **host**. The host is the only one that changes the state.

- The host keeps the room state: the members, who sits in which seat, and the game. It runs every event (a peer joins, a peer leaves, a player asks to move or restart) through the pure functions in `src/room-state.ts`, then broadcasts the whole new state to every peer (the `snapshot` action). An intent that leaves the game as it was (a duplicate, or one the host drops) is answered to its sender alone, so that it stops resending, and a member that sends nonsense makes no broadcasts. Intents from peers that are not members are ignored.
- Guests never change the state themselves. They send what they want to do to the host (the `intent` action) and show the snapshots they get back. The host drops illegal intents: moves the rules reject, spectators, or a room that is not full yet.
- **Seats** are filled in join order, the host first. Anyone after that watches. When a seat frees up, it goes to the first member without one, in join order, with the game as it was (after `onSeatLeft`). With nobody waiting, it stays free for the next peer that joins. A rematch is allowed once the game is over.
- **Late joiners**: the host broadcasts the state whenever a peer joins, so a newcomer gets it at once. That is how a guest who reloads the page (and gets a new peer ID) gets back in: into a free seat, or as a spectator who takes the old seat as soon as the host drops the old ID.
- **Topology**: logically a star. Guests talk only to the host, by its peer ID, and accept snapshots only from it. Trystero still connects every peer in a room to every other one, but nothing here relies on guest-to-guest links. Relaying messages through another player can build on this.
- **Trust**: anyone with the code can join and send anything, so the host checks the shape of every intent before running the rules, and guests check the shape of every snapshot (`src/protocol.ts`). Guests trust the host's decisions.

Messages are JSON strings. Snapshots are small, so sending the whole state is simpler than sending changes.

## When the Host Leaves

The room goes on with another host. Every snapshot carries what the peers need to agree on who that is, without voting (`src/succession.ts`):

- **Members**: every peer in the room, spectators too, in join order, with the host first. The host role is separate from the seats.
- **Successor**: the first member after the host whose link has not dropped too. Every peer works it out from the same last snapshot.
- **Pause**: Trystero's `onPeerLeave` means "my link to that peer dropped", not "it left the room". So only the successor takes over, and only after `takeoverDelayMs`, or at once if the host said goodbye (see below). If the old host comes back within the pause, nothing changes. The others show "The host left. The next player takes over in a moment…" and wait for the successor's snapshot.
- **Promotion**: the successor drops the old host from the members, frees its seat (through `onSeatLeft`, then to the first member without one), moves itself to the front and adds 1 to the **term**. An old host that stepped away stays a member instead, last in line and in its seat, and is dropped only after `awayHoldMs`: the room goes on under the successor, and the old host comes back as a guest. It adds the peers it is connected to and broadcasts. It is then a host like any other.
- **Dropping members**: a host drops a member whose link dropped only after twice `takeoverDelayMs` (5 s by default). A member that comes back in time keeps its place and seat. The wait matters when the host and its successor lose each other: the successor's snapshot reaches the other guests while they still count it as next in line. A peer that leaves on purpose (a reload, closing the tab, `session.leave()`) says goodbye first (the `bye` action, sent once on `beforeunload`, `pagehide` or `leave()`, ahead of Trystero's own leave message), and the host drops it as soon as the link goes, so a reloaded tab finds its seat free. A host that says goodbye is replaced at once, without the pause. Mobile browsers often skip `beforeunload` (iOS Safari always does), hence `pagehide`. Trystero leaves the room on `beforeunload` too, so a page that is still there `takeoverDelayMs` later (the user stayed on it, or the next page is slow) joins the room again as a newcomer, and so does a page back from the back-forward cache (`pageshow` with `persisted`). A host comes back as a guest that hosts the room again if nobody else is there, as with `rejoinAsHost`. A tab that crashes or loses the network says nothing: its seat is held for the full wait, then goes to the first member without one, which may be that same player reloaded.
- **Term**: a guest takes snapshots from the host of its last snapshot, or a newer term from the member next in line, even while its host still looks present. Links drop at different times: the successor may have lost the host and taken over while this guest still sees it, or never loses it at all in a short blip. A guest never goes back to an older term, and a host that sees a newer term from another peer steps down and becomes a guest. That covers an old host whose network came back after the room moved on. A host that steps down passes the new host's snapshot on to its guests, and they take it from their host even though it names another one: that moves a newcomer that found the old host first. A guest with no link to the new host joins the room again instead of following it, since it could neither send to that host nor hear from it.
- **Two hosts**: two hosts of the same term happen when a player starts a room under a code whose room it could not reach yet (a game's "start this room" button), or when peers lose links to each other in different ways and two of them take over at once. When their snapshots meet, the older room keeps it: every snapshot carries `createdAt`, set by the room's first host and kept through every handover, so a room just started never replaces a game in progress. Member counts can't tell those apart, because once connected each host counts the other's players too. Two halves of one room are the same age, and the lower peer ID keeps it. Both hosts decide on values that don't change, so exactly one of them wins: member counts would not do for halves either, since each host reads its own as they are now and the other's as they were sent. The winner starts a newer term, and the other steps down and passes it on to its guests (`winsTie` in `src/succession.ts`). A snapshot from a page loaded before `createdAt` existed counts as the oldest room.
- **Joining again**: Trystero leaves a room in steps (a goodbye, 99 ms, then it closes the room's links), and it shares links between rooms with the same peers. A room joined again in the same tab meanwhile would lose its links and stay without peers. So the Trystero transport is wrapped by `joinAfterLeave` (`src/join-after-leave.ts`): it joins a room only once the tab has left it, with a stand-in room with no peers until then. That covers a stuck guest, a page that stayed after `beforeunload`, and a page that starts a new session for the room it just left.
- **Last intent**: every intent has an ID that goes up with each one its sender sends, and the snapshot records the last ID the host handled from each member (`handled`). A guest keeps its last intent until a snapshot shows it handled, and sends it once more to a host it has not followed before that has not handled it: one that took over, one its host hands it to, or the one it finds after joining the room again. The host handles each ID once, so a resent move is never applied twice, whatever the game.
- **Alone**: a guest that is the last member becomes the host of a room of one and waits for others. `hostLeft` is only for a guest that can't take over.
- **Stuck**: a guest that still waits for the successor four times `takeoverDelayMs` after the host went quiet (10 s by default) has lost its own links, not the room: the successor would have taken over by now, unless it still sees the host. The guest leaves the room and joins it again as a newcomer, which builds new links. With the same peer ID, it keeps its place and seat if the host still has them.
- **Back from away**: a phone freezes a hidden page, so its last snapshot may be old. A successor that is hidden, or was shown again in the last twelve times `takeoverDelayMs` (30 s by default), does not take over from it when the host's link drops: that would undo what the host did meanwhile. It joins the room again instead and finds the host if it is still there. If nobody is, it hosts the game as it last saw it (`hostAlone` in `src/succession.ts`), as a room started now, so it gives way to the room if that went on elsewhere. A host that joins again after a cancelled unload or the back-forward cache does the same.
- **Reloaded host**: with `rejoinAsHost`, a host that reloads and finds nobody hosts the room again. If the room went on under another host meanwhile, that host has a newer term, so the reloaded tab steps down as soon as they connect.

Trust: the member next in line can take the host role whenever it wants, by sending a newer term, and a host can hand its guests to anyone by passing on a snapshot. A newcomer takes the first snapshot it gets. Among people who share a room code, that's acceptable.

Limits:

- A guest that lost only its own link to a host that still serves the others joins the room again after about 10 seconds plus the time WebRTC takes to notice. If its network still can't reach the host, it shows as `unreachable`. Relaying messages through another player is the later fix.
- A tab that closes normally tells the others at once. A crashed tab or a lost network is noticed only when WebRTC gives up on the link, which took about 10 seconds in testing, plus the pause.
- Two hosts merge only when they connect to each other. Until then, each keeps the peers that hear it first.

## Signaling Server

`src/signaling-url.ts` picks `wss://signaling.when.party` (`games/platform/signaling`), or `ws://localhost:8080` for pages on `localhost` and `127.0.0.1`. A test checks that this package and the signaling server use the same `@trystero-p2p/ws-relay` version.

## Dev Server Headers

`src/dev-headers.ts` (`@whenparty/p2p/dev-headers`) holds the production `Content-Security-Policy` and `Permissions-Policy` from `infra/nginx/conf.d/`, plus the local signaling server. Titles send them from the Vite dev and preview servers, so a script from a CDN or a connection to another server fails locally the same way it would in production. Keep them in sync when the nginx headers change.

## Code Layout

```
src/
  index.ts           # the public API
  room-code.ts       # make and check room codes
  room-state.ts      # GameRules interface; members, seats, joins, leaves and intents (pure)
  succession.ts      # who takes over from a host that left, and which snapshots to trust (pure)
  protocol.ts        # encode and check what goes over the wire (pure)
  session.ts         # Trystero: runs the host or a guest, hands over the host role, calls onChange
  join-after-leave.ts # joins a room again only once the tab has left it (wraps the Trystero transport)
  signaling-url.ts   # which signaling server to use
  dev-headers.ts     # production headers for the Vite dev servers
  tests/             # node:test, with a tiny test game (race.ts) and an in-memory network
```

`session.ts` is tested against `tests/fake-network.ts`, an in-memory stand-in for Trystero where cutting a link and noticing it are separate steps, so handovers with links that drop at different times can be replayed. The real WebRTC path is covered by browser checks: three tabs where the host closes its tab, two tabs where the host reloads, a host alone that reloads, and a guest while the signaling server is down (see the title READMEs).

## Limits

- There is no TURN server yet. Players behind strict NAT (some mobile and corporate networks) may never connect to each other.
- Data channels only. `Permissions-Policy` blocks camera and microphone on every `*.when.party` site.
