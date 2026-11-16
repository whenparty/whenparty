# Status

- `3-1` Until starting or entering fails or the game ends, the status in the room view ([2-3](2-page.md)) is the text of the first row of this table that applies; [4-1](4-endings.md) gives it after that. In the table, CODE stands for the room code, SEAT for the seat that the row names and OTHER for the other seat. Waiting for the host, "host away", the lost server, "rules error" and the last snapshot that the page took are as the netcode tells them in the game ([2-1](../../../../platform/netcode/docs/specs/2-page.md), [2-9](../../../../platform/netcode/docs/specs/2-page.md) and [2-10](../../../../platform/netcode/docs/specs/2-page.md), [3-2](../../../../platform/netcode/docs/specs/3-entry.md) and [3-6](../../../../platform/netcode/docs/specs/3-entry.md), [1-4](../../../../platform/netcode/docs/specs/1-rules.md)). Waiting for the host lasts from the netcode's notice that the page waits until the netcode next tells that the page is entering ([2-6](../../../../platform/netcode/docs/specs/2-page.md)) or the page takes its first snapshot, or until entering fails, the game ends or the person leaves.
  | When | Status |
  | --- | --- |
  | the page started the game, and has taken no snapshot in it | Creating a room… |
  | the page waits for the host, who decides | Waiting for the host of CODE to let you in… |
  | the page waits for the host, who is offline | Waiting for the host of CODE to come back… |
  | the netcode told the page "host away" and not "host back" since | The connection to the host is lost. The game goes on when it is back. |
  | while the server is lost; the status is this text, a space and the text of the first later row that applies | New players cannot join right now: the game server is out of reach. |
  | after the netcode told "rules error"; the status is this text, a space and the text of the first later row that applies | This game has an error. |
  | the page entered the game, and has taken no snapshot in it | Looking for room CODE… |
  | the last match ended because SEAT left ([1-8](1-rules.md)), no match runs and that seat is free | SEAT left, so the match is over. Send the code to a new player. |
  | no match runs, and a seat is free | Waiting for a second player. Send them the code. |
  | the last match ended because SEAT was hidden too long ([1-7](1-rules.md)), and no match runs | SEAT was away too long, so the match is over. |
  | the last match ended with a win of SEAT ([1-4](1-rules.md)), and no match runs | SEAT wins. |
  | the last match ended in a draw ([1-5](1-rules.md)), and no match runs | Draw. |
  | no match runs, and both seats have players | Ready for the next match. |
  | the match is paused because both players are away ([1-6](1-rules.md)) | Paused: both players are away. |
  | the match is paused because SEAT is away | Paused: SEAT is away. The match goes on when they are back. |
  | this page is a spectator, and SEAT is to move | You are watching. SEAT to move. |
  | this page's seat SEAT is to move | Your turn. You are SEAT. |
  | this page's seat is SEAT, and OTHER is to move | You are SEAT. OTHER to move. |
