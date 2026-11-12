# Game

- `2-1` The netcode is the part of the platform that titles play through. A title gives it an app ID ([1-1](../../rooms/docs/specs/1-room.md)), a waiting time ([1-3](../../rooms/docs/specs/1-room.md)) and its rules: the functions in this table, which the netcode calls on the host's page. States and actions are JSON values. Room time is in milliseconds ([5-7](5-matches.md)), and a random number is an integer from 0 to 2³² − 1 that the netcode draws for each call.
  | Rule | Required | Gets | Returns |
  | --- | --- | --- | --- |
  | seats | yes | nothing | 1 to 12 distinct names of 1 to 16 Unicode code points each, such as X and O |
  | initial state | yes | a random number and the room time | the state of a new match |
  | step | yes | a state, a seat, an action, a random number and the room time | the next state, or none to refuse the action |
  | over | yes | a state | whether its match is over |
  | is action | yes | a value | whether it has the form of an action |
  | is state | yes | a value | whether it has the form of a state |
  | presence | no | a state, a seat, a presence event ([4-1](../../rooms/docs/specs/4-presence.md)) and the room time | the next state |
  | deadlines | no | a state | the room times at which the state needs a call of "deadline" |
  | deadline | no | a state, one of its deadlines, a random number and the room time | the next state |
  | admit | no | the last state or none, and a public number | whether to let that participant in |
  | can start | no | the last state or none, and the seats that have players | whether a match may start |
- `2-2` The netcode gives each rules function its own copy of its input, so that what the function does to it changes nothing. A function that throws counts as one that returns a value of the wrong form; [4-4](4-actions.md) and [5-8](5-matches.md) say what follows.
- `2-3` When a page starts a game, the netcode creates a room with the title's app ID and waiting time, and the page's participant becomes the game's host. Starting fails as creating a room fails, with "bad app", "bad wait", "busy" or "offline" ([1-1, 1-3, 1-4 and 1-5](../../rooms/docs/specs/1-room.md)). Once the room is created, the netcode tells the page the room code.
- `2-4` When a page enters a game with a room code, or with text that a person typed, the netcode joins the room. Entering fails as joining or returning fails, with "bad app", "offline", "no room", "owner away", "full", "refused" or "unreachable" ([1-1 and 1-4](../../rooms/docs/specs/1-room.md), [2-1 to 2-7](../../rooms/docs/specs/2-join.md)). After the join completes, entering completes when the page takes its first snapshot ([3-5](3-snapshots.md)). When it has not taken one 15 seconds after the join completed, the netcode leaves the room and entering fails with "unreachable".
- `2-5` When the seats are not as 2-1 says, starting or entering fails with "bad rules" before the netcode creates or joins a room.
- `2-6` Every participant of the room whose join completed is a participant of the game, the host too. A participant on a seat is a player, and one without a seat is a spectator.
- `2-7` When a page of a participant other than the host leaves the game, the netcode leaves the room ([4-5](../../rooms/docs/specs/4-presence.md)). When a page of the host ends the game, the netcode leaves the room as the owner, which closes it ([4-6](../../rooms/docs/specs/4-presence.md)).
- `2-8` When the rooms module tells a page "room closed" or "you left" ([4-8](../../rooms/docs/specs/4-presence.md)), the netcode tells the page once that the game ended, with that cause, and then tells it nothing more about the game.
- `2-9` The netcode tells each page of a participant its public number and seat with each snapshot that the page takes, and "host away" and "host back" when the rooms module tells "owner lost" and "owner back" ([4-4](../../rooms/docs/specs/4-presence.md)).
