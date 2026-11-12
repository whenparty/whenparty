# Joining

- `2-1` When a page joins a room with text that is not a room code ([1-2](1-room.md)), joining fails with "no room" before the page opens a signaling connection. Otherwise the rooms server answers with the first row of this table that applies, or fails as [1-4](1-room.md) says:
  | When | Answer |
  | --- | --- |
  | no open room of the app ID has the code | joining fails with "no room" |
  | no page of the owner has an open signaling connection | joining fails with "owner away" |
  | 12 participants count in the room (2-5), the owner included | joining fails with "full" |
  | otherwise | the server asks the owner's controlling page (2-2) |
- `2-2` The owner's app is told of the join request with the public number that the participant would get, and lets the participant in or refuses it. When it refuses, joining fails with "refused". When the owner's page has not answered 10 seconds after the server asked it, joining fails with "owner away".
- `2-3` When the owner lets the participant in, the rooms server gives the participant a token and the room's next public number, 2, 3 and on, which the room never gives again, even after a failed join. It tells the page the room's waiting time, makes the page the participant's controlling page ([5-2](5-pages.md)) and tells the owner's controlling page its peer ID. The page then connects to the owner's controlling page ([2-1](../../../transport/docs/specs/2-connection.md)). The owner's page accepts an incoming peer connection only from a page that the rooms server named to it as a participant's controlling page, and refuses every other.
- `2-4` When the peer connection to the owner opens, the join completes: the page is told its public number, and the owner's app is told that the participant joined. When it has not opened 30 seconds after the server let the participant in, or closes before it opened, joining fails with "unreachable", the page closes it, and the participant leaves the room ([4-5](4-presence.md)) without the owner's app being told.
- `2-5` A participant counts in the room from when the rooms server asks the owner about it until its join fails or it leaves the room.
- `2-6` When a page joins a room whose code its record holds with a token ([5-1](5-pages.md)), it returns instead, with the answer of the first row of this table that applies, or fails as [1-4](1-room.md) says:
  | When | Answer |
  | --- | --- |
  | no open room of the app ID has the code | the page deletes its record, and returning fails with "no room" |
  | the room has no participant with the token, and the page was in the room before | the participant has left the room, as [4-8](4-presence.md) says |
  | the room has no participant with the token | the page deletes the token from its record and joins as a new participant (2-1) |
  | the token is the owner's | the page becomes the owner's controlling page, as [5-5](5-pages.md) says |
  | no page of the owner has an open signaling connection | the page keeps the token and asks again every 5 seconds |
  | otherwise | the page becomes the participant's controlling page and connects to the owner, as 2-3 and 2-4 say, without asking the owner's app |
- `2-7` A returning page that has asked again for the room's waiting time without an answer other than "owner away" stops, and the room ends for it as [4-4](4-presence.md) says.
