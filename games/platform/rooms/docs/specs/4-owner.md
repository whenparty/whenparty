# Owner page

- `4-1` The owner's page goes through these states until the room ends for it or creating fails. It enters "returning" when it returns with the owner's token of its record ([5-1](5-owner-return.md)), and leaves it as [5-1](5-owner-return.md), [5-3](5-owner-return.md), [5-4](5-owner-return.md) and [5-6](5-owner-return.md) say. In any state the app can leave ([8-2](8-ending.md)).
  ```mermaid
  stateDiagram-v2
    [*] --> creating: create (4-2)
    [*] --> returning: owner's token in the record
    creating --> owning: created (4-2)
    owning --> offline: signaling closes (4-4)
    offline --> owning: roster (4-5)
    returning --> owning: term and roster
    creating --> [*]: fails (4-2)
    owning --> [*]: room ends (4-6, 4-7)
    offline --> [*]: room ends (4-6, 4-7)
    returning --> [*]: room ends
  ```
- `4-2` When the app creates a room with an app ID and a waiting time, the page takes the lock, goes on as the record decides ([9-5](9-tab.md)), and asks the rooms server over a signaling connection to create a room. When the answer ([12-1](12-server-answers.md)) is that the room is created, the app is told the room's code and term, and the page writes the record. When the answer is "bad app", "bad wait" or "busy", creating fails with that reason. Creating fails with "offline" when the signaling connection cannot open ([1-13](1-room.md)) or closes before the answer, or when the request gets no answer ([1-12](1-room.md)).
- `4-3` The term numbers the owner's pages of a room: it is 1 when the room is created, and each owner's page that starts anew ([9-3](9-tab.md)) and returns gets a higher one ([10-4](10-server-room.md), [10-7](10-server-room.md)). The app is told the term when the room is created and when a return of the owner succeeds.
- `4-4` When the page's signaling connection that is the owner connection ([10-5](10-server-room.md)) closes, the room goes on, and the app is told "server lost". The owner connection is lost since the last time anything arrived over it, as the transport reports with its closing ([1-15](../../../transport/docs/specs/1-signaling.md)), and the page keeps that moment in the record. The page opens a new signaling connection at once, and again 5 seconds after each one that cannot open ([1-13](1-room.md)), closes before the answer of 4-5, or whose request gets no answer ([1-12](1-room.md)). The app is not told "server lost" again before "server back".
- `4-5` On each new signaling connection, the page asks the rooms server to reconnect, with the leaves that the server does not know yet ([6-7](6-presence.md)). When the answer is the roster ([10-6](10-server-room.md)), the app is told "server back", and the page treats the roster as [6-9](6-presence.md) says.
- `4-6` The room ends for the owner's page with these reasons:
  | When | Reason |
  | --- | --- |
  | a request to reconnect gets "no room" or "removed" | "owner away" when the waiting time has passed since the owner connection was lost, "room closed" otherwise |
  | the rooms server says that it closed the room ([10-3](10-server-room.md)) | "room closed" |

  The page then sends "room closed" to each participant whose peer connection is open for rooms, and ends as [8-4](8-ending.md) says ([4-5](../../../transport/docs/specs/4-delivery.md)).
- `4-7` When the page has been alone for the whole waiting time without a break, or no page of the room has been visible for the whole waiting time without a break, the page leaves as [8-2](8-ending.md) says, sending "idle" in place of "room closed", and the room ends for it with "idle". The page is alone while it knows no number other than 1, lost numbers included, and has no pending join request ([6-2](6-presence.md)). The owner's page is visible while the browser reports it so, and a participant's page while its peer connection is open for rooms and the visibility that it last sent is "visible". The page counts both from when the room is created or its return succeeds, and a page that starts anew counts anew.
