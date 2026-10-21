# Session states

`step(model, event, env)` in `src/session-machine.ts` is pure. `session.ts` runs its effects and timers. Games own match rules and results.

## Phases

| Phase | Meaning |
| --- | --- |
| `waiting` | Looking for a room, or a reloaded creator waiting for a retained snapshot. |
| `following` | Following the creator; a reservation for the creator means a wait for their return. |
| `hosting` | The creator's controlling connection runs the room. |
| `closed` | The session has ended and ignores later events. |

`room.hostId` identifies the creator throughout the room's lifetime. A guest cannot become its host. `term` increases when the same creator returns on another connection, so an old connection cannot replace it.

## Snapshot acceptance

`decideSnapshot` in [src/handover.ts](src/handover.ts) is the one place that decides what a tab does with a snapshot; [its tests](src/tests/handover.test.ts) check every row.

| Tab | Snapshot | Decision |
| --- | --- | --- |
| any | another creator, or an older term | ignore |
| guest | from the creator's current connection, same or newer term | follow |
| guest | from its previous host, newer term (handover to the creator's new tab) | follow |
| guest | same term, another connection of the creator | ignore |
| creator, waiting | from a member, or naming this connection as host; hidden only after a reload | restore, or expired if the retained reservation ran out |
| creator, any | newer term naming this connection as host, from anyone | host |
| creator, hosting | same term from a rival tab of the creator | the lower connection ID keeps the room: outrank (newer term) or follow |

A reloaded creator obtains a retained snapshot from a connected member waiting for them. A restored page can reuse its own room. Restoration keeps the game and remaining reservations. A reloaded creator linked to nobody after `restoreGraceMs` (3 seconds by default) hosts a fresh room under its code; one that is linked but gets no snapshot closes after `seatHoldMs`. The signaling server stores no game state. Another tab of the creator restores the room from the host's snapshot and takes it over; the older tab follows, and hosts again if the controlling tab's connection drops while it is visible. A hidden tab waits until it is shown. Two creator tabs hosting the same term resolve to the lower connection ID, which starts a newer term so the other tab and its guests follow. Creating a room generates a new code. Joining an unanswered code never starts a room.

## Absence

Hiding a page, closing it or detecting connection loss starts one reservation for that player. `seatHoldMs` defaults to two minutes and must be a nonnegative safe integer. Repeated absence signals and an unconfirmed connection keep the existing deadline.

Confirmed availability before expiry clears the reservation. Each later absence starts a full wait. When a player's controlling connection drops while another of its tabs is linked, that tab takes control and no reservation starts. A hidden tab announcing itself does not take control of its player. At or after expiry the player leaves before any new admission. Explicit leave is immediate. Guests wait for an absent creator and close the room when the deadline expires or the creator explicitly leaves.

A reserved player is absent (`isAbsent`). Games receive `lost`, `back` and `left`; each game decides whether an absent participant prevents play. `onPresence` sees the departing seat as occupied during `left`. The platform requires all seats occupied for a rematch.

The host advances elapsed `room.clock` before sending a snapshot. Receivers anchor it to their local monotonic time. Reservations use this room clock; device timestamps never cross the wire. Transit time affects when snapshots are observed. Page removal stops that connection and its timers; restoration checks existing deadlines before reconnecting. A hidden page's own intents are dropped.

## The game

Games see the room through `RoomContext`: occupied seats, absent seats and room time. A game that waits for something lists its deadlines in `deadlinesOf`, in room time; the host keeps a timer for each and calls `onDeadline` when one is due, then broadcasts the result. `applyMove`, `onPresence` and `onDeadline` all run on the host.

## Verification

[Machine tests](src/tests/session-machine.test.ts) cover rules and deadlines; `invariantViolations` runs after every step there and in the fuzz. [Session tests](src/tests/session.test.ts) cover delivery, creator restoration and connection failure. [Seeded fuzz tests](src/tests/session-fuzz.test.ts) explore event interleavings and check that sessions converge or close without promoting guests.
