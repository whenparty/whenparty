# Page

- `2-1` A game is the play of one room on a page, from when the page starts or enters it until starting or entering fails, the game ends or the person leaves. For each game, the page goes through the states of this diagram; [3-1](3-entry.md) shows those of entering on a participant's page. In every state but failed and ended, the person can leave the game (2-11), which the diagram does not show.
  ```mermaid
  stateDiagram-v2
    [*] --> starting: start
    [*] --> entering: enter by code
    starting --> playing: room created
    entering --> playing: first snapshot or recovered
    starting --> failed: starting fails
    entering --> failed: first entry fails
    entering --> ended: return by record ends
    playing --> hostAway: host away
    hostAway --> playing: host back
    playing --> ended: game ends
    hostAway --> ended: game ends
  ```
- `2-2` When the rooms module fails creating or joining with "open elsewhere" ([9-2](../../../rooms/docs/specs/9-tab.md)), starting or entering fails with "open elsewhere", and the netcode does nothing more for that game.
- `2-3` When a page starts a game, the netcode creates a room with the title's app ID and waiting time ([4-2](../../../rooms/docs/specs/4-owner.md)), and the page's participant, the room's owner ([1-4](../../../rooms/docs/specs/1-room.md)), becomes the game's host. Starting completes when the netcode tells the page the room code. Starting fails with "bad rules" before the netcode creates a room when the title's rules are bad ([1-6](1-rules.md)), and with "bad app", "bad wait", "busy", "offline" or "outdated" ([8-6](../../../rooms/docs/specs/8-ending.md)) when the rooms module fails creating with that cause.
- `2-4` The netcode turns text that a person typed into a room code as the rooms module does ([1-3](../../../rooms/docs/specs/1-room.md)), and says whether the result is a room code.
- `2-5` When a page enters a game by a room code, entering fails with "bad rules" before the netcode enters the room when the title's rules are bad ([1-6](1-rules.md)). Otherwise the netcode joins the room with the page's versions ([3-4](3-entry.md)) as the join data of its join request ([1-15](../../../rooms/docs/specs/1-room.md), [2-3](../../../rooms/docs/specs/2-join.md)). When the rooms module tells that the join goes on as a return from the record ([9-8](../../../rooms/docs/specs/9-tab.md)), entering is a return by record: of a participant as [3-7](3-entry.md) says, or of the host as [10-1](10-recovery.md) says. Otherwise it is a first entry ([3-3](3-entry.md)).
- `2-6` The netcode tells a page that it is entering from when it starts entering until entering completes or fails, the game ends or the person leaves, except while it waits for the host ([3-2](3-entry.md)).
- `2-7` The netcode tells a page once that the game ended, with its cause, and then tells it nothing more about the game. The causes are "other version" ([3-5](3-entry.md)) and the reasons with which the room ends for the page in the rooms module ([3-7](../../../rooms/docs/specs/3-participant.md) and [3-8](../../../rooms/docs/specs/3-participant.md), [4-6](../../../rooms/docs/specs/4-owner.md) and [4-7](../../../rooms/docs/specs/4-owner.md), [5-4](../../../rooms/docs/specs/5-owner-return.md)): "room closed", "idle", "owner away", "removed", "unreachable", "no relay" and "outdated" ([8-6](../../../rooms/docs/specs/8-ending.md)). On a first entry, an end of the room before the first snapshot is a failure instead (2-13).
- `2-8` With "other version", as a failure or a cause, the netcode tells whether the page's versions or the host's are older ([3-4](3-entry.md)). With "outdated", it tells that the page's side is older when the rooms module tells that the page or the owner's page is older, and otherwise that the server's is ([8-6](../../../rooms/docs/specs/8-ending.md)).
- `2-9` While the host's page plays, the netcode tells it each time the rooms module tells that the server is lost or back ([4-4](../../../rooms/docs/specs/4-owner.md) and [4-5](../../../rooms/docs/specs/4-owner.md)).
- `2-10` With each snapshot that a page takes, the netcode tells the page the snapshot ([9-2](9-snapshots.md)), its participant's public number ([1-5](../../../rooms/docs/specs/1-room.md)) and seat, or that it has no seat, and whether the page is the host's. The netcode tells a page about the room only what this specification names, and not, for example, the path and round-trip time of a connection ([1-10](../../../rooms/docs/specs/1-room.md)).
- `2-11` When the person leaves the game on a page, the netcode makes the page's participant leave the room ([8-1](../../../rooms/docs/specs/8-ending.md) and [8-2](../../../rooms/docs/specs/8-ending.md)), which for the host closes the room for all. Leaving ends starting or entering that has not completed, and a late answer to it creates nothing ([8-3](../../../rooms/docs/specs/8-ending.md) and [8-5](../../../rooms/docs/specs/8-ending.md)); it also ends waiting for the host ([3-2](3-entry.md)) or for the term and roster ([10-2](10-recovery.md)). Then the netcode tells the page nothing more about the game.
- `2-12` When a page starts or enters a game while its last game goes on, the netcode first leaves that game as 2-11 says.
- `2-13` A first entry fails with "bad app", "no room", "full", "busy", "refused", "unreachable", "offline" or "outdated" when the rooms module fails the join with that cause ([2-2](../../../rooms/docs/specs/2-join.md), [2-3](../../../rooms/docs/specs/2-join.md), [2-5](../../../rooms/docs/specs/2-join.md), [2-6](../../../rooms/docs/specs/2-join.md), [2-10](../../../rooms/docs/specs/2-join.md) and [2-11](../../../rooms/docs/specs/2-join.md), [8-6](../../../rooms/docs/specs/8-ending.md)), except for a refusal that carries the host's versions ([3-5](3-entry.md)). When the room ends for the page after the join completed and before the page's first snapshot, entering fails as this table says:
  | Cause of the end of the room | Entering fails with |
  | --- | --- |
  | "room closed" or "idle" | "no room" |
  | "owner away" | "owner away" |
  | "removed", "unreachable" or "no relay" | "unreachable" |
  | "outdated" | "outdated" |
