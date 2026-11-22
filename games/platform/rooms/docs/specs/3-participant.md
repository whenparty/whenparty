# Participant in a room

- `3-1` A participant's page in a room goes through these states until the room ends for it. It enters "in" when its join completes ([2-8](2-join.md)) and "lost" when it returns from the record (3-9). In either state the app can leave ([8-1](8-ending.md)).
  ```mermaid
  stateDiagram-v2
    [*] --> in: join completes
    [*] --> lost: return from the record (3-9)
    in --> lost: connection closes (3-3)
    lost --> in: return succeeds (3-5)
    in --> [*]: room ends (3-8)
    lost --> [*]: room ends (3-7, 3-8)
  ```
- `3-2` A participant's page opens a signaling connection only to ask to join or to return, and to leave as [9-6](9-tab.md) says. When the connection closes while no request of the page waits for an answer, nothing changes for the page and the owner's page is not told; the page opens a new one only when it next needs to ask.
- `3-3` When the page's peer connection to the owner's page that is open for rooms closes, the app is told "owner lost", and the page returns (3-4). The owner is lost since the last time anything arrived over that connection, as the transport reports with its closing ([3-15](../../../transport/docs/specs/3-connection.md)), and the page keeps that moment in the record.
- `3-4` To return, the page opens a signaling connection when it has none open, and asks the rooms server to return with its token. When the answer ([12-3](12-server-answers.md)) gives the peer ID of the owner's page, the page connects to it; the owner's app is not asked.
- `3-5` A return succeeds when the new peer connection opens for rooms ([1-8](1-room.md)): the app is told "owner back", and the page is in the room.
- `3-6` When a return gets "owner away", or gets no answer ([1-12](1-room.md)), or its signaling connection cannot open ([1-13](1-room.md)) or closes before the answer, or its peer connection closes before it opens for rooms, the page asks to return again 5 seconds later.
- `3-7` When the waiting time has passed since the owner was lost and the page is not in the room, the page stops returning and the room ends for it: with "unreachable" when the latest answer to its returns gave it the peer ID of the owner's page, "no relay" when, in addition, its latest peer connection closed with `no relay` ([3-9](../../../transport/docs/specs/3-connection.md)), and "owner away" otherwise. The page tells the rooms server that it leaves, when its signaling connection is open.
- `3-8` The room also ends for the page with these reasons:
  | When                                                       | Reason                                                                                                                                                      |
  | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | a return gets "no room"                                    | "owner away" when the waiting time has passed since the owner was lost, "room closed" otherwise                                                             |
  | a return gets "removed"                                    | "removed", except after a join with the record's code ([9-5](9-tab.md)): then the page deletes the record and joins as a new participant ([2-3](2-join.md)) |
  | the owner's page sends "room closed", "idle" or "outdated" | that reason                                                                                                                                                 |
- `3-9` When the page returns from a record with a participant's token ([9-5](9-tab.md)), the owner is lost since the moment that the record keeps. When the record keeps none, the page writes the moment its return started into the record and counts from it. The app is not told "owner lost".
- `3-10` The page has at most one peer connection to the owner's page and starts a new one only after closing the previous one. An event of a previous peer connection or signaling connection that arrives after the page started a new one changes nothing: it does not close the new one or change the page's state.
