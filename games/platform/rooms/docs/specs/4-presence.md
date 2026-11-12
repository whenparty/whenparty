# Presence

- `4-1` The owner's app is told these events about each participant whose join completed, each once for each cause and in the order of the causes, and nothing about the participant after "left":
  | Event | When |
  | --- | --- |
  | hidden | the participant's controlling page becomes hidden, as the browser reports it, or is hidden when its peer connection to the owner opens |
  | visible | that page becomes visible again while its peer connection to the owner is open |
  | lost | the peer connection between the owner's controlling page and the participant's controlling page breaks or closes |
  | back | a peer connection from the participant's controlling page to the owner's opens after "lost" |
  | left | the participant leaves the room (4-3, 4-5) |
- `4-2` Signaling connections do not count: a participant whose peer connection to the owner is open is present even when its signaling connection is closed, and one whose peer connection broke is lost even when its signaling connection is open. While lost, the participant's page returns ([2-6](2-join.md)) to reach the owner's current controlling page.
- `4-3` When a participant has been lost for the room's waiting time, it leaves the room: the owner's app is told "left", and the owner's page tells the rooms server, which cancels the participant's token. When the owner's page has no open signaling connection then, it does not tell the server, then or later. When the participant later returns with that token, the owner's app is told that it joined ([2-4](2-join.md)), with the same public number.
- `4-4` A participant's page is told "owner lost" when its peer connection to the owner breaks or closes, and "owner back" when a peer connection to the owner's controlling page opens again. When the owner is not back for the room's waiting time since "owner lost", the room ends for the participant.
- `4-5` When a page of a participant other than the owner leaves the room, the rooms server cancels the participant's token as soon as it learns of it from that page or from the owner's page, and the owner's app is told "left" as soon as the owner's page learns of it from the server or from the participant's page.
- `4-6` When a page of the owner leaves the room, the room closes ([1-9](1-room.md)), and the room ends for each participant as soon as its page learns of it from the owner's page or from the rooms server.
- `4-7` When the signaling connection of the owner's controlling page closes, the room goes on without it. While the room is open, the page opens a new signaling connection at once and then every 5 seconds until one opens. With each new one, the rooms server makes the page the owner's controlling page again, and the term stays. When the server has no such room, the room ends for the owner and closes as 4-6 says.
- `4-8` When the room ends for a participant, the owner included, or the participant leaves it, each page of the participant is told once "room closed" or "you left", unless it is the page that left. Then the page deletes its record ([5-1](5-pages.md)), closes its peer connections and signaling connection, and tells its app nothing more about the room.
