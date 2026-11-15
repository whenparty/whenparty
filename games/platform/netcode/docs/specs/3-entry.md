# Entering and returning

- `3-1` A participant's page enters and returns through the states of this diagram. It leaves out failures, ends and leaving, which [2-1](2-page.md) shows.
  ```mermaid
  stateDiagram-v2
    [*] --> joining: first entry
    [*] --> returning: return by record
    joining --> waiting: host asked or offline
    waiting --> joining: let in
    joining --> joined: join completes
    joined --> playing: first snapshot
    returning --> playing: first snapshot
    returning --> joining: removed, enters as new
    playing --> hostAway: host away
    hostAway --> playing: host back
  ```
- `3-2` When the rooms module tells a page on a first entry that the owner is asked about it, or that the page waits for the owner ([2-3](../../../rooms/docs/specs/2-join.md) and [2-4](../../../rooms/docs/specs/2-join.md)), the netcode tells the page that it waits for the host, and whether the host decides or is offline, and tells it again each time this changes. Waiting ends when the rooms module tells the page that the owner let it in ([2-7](../../../rooms/docs/specs/2-join.md)), or when entering fails.
- `3-3` A first entry completes when the rooms module completes the join ([2-8](../../../rooms/docs/specs/2-join.md)) and then the page takes its first snapshot ([9-9](9-snapshots.md)). Until then the netcode tells the page neither "host away" nor "host back", even when the rooms module tells "owner lost" and "owner back". After the join completes, entering has no time limit, even while the connection to the host is open: it ends only when the page takes a snapshot, the person leaves, or entering fails.
- `3-4` A page's versions are its netcode protocol version, a whole number from 1 to 1,000,000 that is 1 for the netcode this specification describes, and the title's format version ([1-1](1-rules.md)). The join data ([1-15](../../../rooms/docs/specs/1-room.md)) of each join request and of each refusal by the host, and each snapshot, are JSON objects whose field "versions" is the array of these two numbers in that order, in every protocol version. A page's versions are older than another's when its protocol version is lower or, with equal protocol versions, its format version is lower.
- `3-5` A participant's page reads the versions of each snapshot before anything else in it ([9-9](9-snapshots.md)). When they differ from its own, the page leaves the room ([8-1](../../../rooms/docs/specs/8-ending.md)): a first entry fails, and a return by record or a game that goes on ends, with "other version". When the host refuses a join with its versions ([4-1](4-seats.md)), the first entry fails with "other version".
- `3-6` When the rooms module tells "owner lost" to a page that has taken a snapshot ([3-3](../../../rooms/docs/specs/3-participant.md)), the netcode tells the page "host away", unless it told "host away" and not "host back" since. The return completes when, after the rooms module told "owner back" ([3-5](../../../rooms/docs/specs/3-participant.md)), the page takes a snapshot, or gets a snapshot that carries the page's own versions and has the term and number of the last one it took ([9-9](9-snapshots.md)); then the netcode tells the page "host back". A snapshot that the page drops does not complete the return.
- `3-7` When a participant's page returns by record ([3-9](../../../rooms/docs/specs/3-participant.md)), it is entering until it takes its first snapshot, and the netcode tells it no "host away" before that. When the room ends for the page before then, the game ends with the cause that the rooms module gives ([2-7](2-page.md)), and entering does not fail. When the rooms module answers the return with "removed" and enters the page as a new participant ([3-8](../../../rooms/docs/specs/3-participant.md)), the entry goes on as a first entry.
