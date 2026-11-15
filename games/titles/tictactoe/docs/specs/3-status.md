# Status

- `3-1` The status in the room view ([2-3](2-page.md)) is that of [4-1](4-endings.md) after starting or entering failed or the game ended. Otherwise it is the text of the first row of this table that applies, in which CODE stands for the room code, SEAT for the seat that the row names and OTHER for the other seat. Starting, entering, waiting for the host, "host away", the lost server, "rules error" and the snapshot that the page took are as the netcode tells them ([2-3](../../../../platform/netcode/docs/specs/2-page.md), [2-6](../../../../platform/netcode/docs/specs/2-page.md), [2-9](../../../../platform/netcode/docs/specs/2-page.md) and [2-10](../../../../platform/netcode/docs/specs/2-page.md), [3-2](../../../../platform/netcode/docs/specs/3-entry.md) and [3-6](../../../../platform/netcode/docs/specs/3-entry.md), [1-4](../../../../platform/netcode/docs/specs/1-rules.md)).
  | When | Status |
  | --- | --- |
  | the page starts a game, and starting has not completed | Creating a room… |
  | the page waits for the host, who decides | Waiting for the host of CODE to let you in… |
  | the page waits for the host, who is offline | Waiting for the host of CODE to come back… |
  | the netcode told the page "host away" and not "host back" since | The connection to the host is lost. The game goes on when it is back. |
  | on the host's page, while the server is lost; the status goes on with the text of the first later row that applies | New players cannot join right now: the game server is out of reach. |
  | on the host's page, after the netcode told "rules error" and before the page took another snapshot; the status goes on with the text of the first later row that applies | This game has an error. |
  | the page is entering | Looking for room CODE… |
  | the last match ended because SEAT was hidden too long ([1-7](1-rules.md)), and no match runs | SEAT was away too long, so the match is over. |
  | the last match ended because SEAT left ([1-8](1-rules.md)), and that seat is still free | SEAT left, so the match is over. Send the code to a new player. |
  | the last match ended with a win of this page's seat ([1-4](1-rules.md)), of SEAT, or in a draw ([1-5](1-rules.md)), and no match runs | You win! / SEAT wins. / Draw. |
  | no match runs, and a seat is free | Waiting for a second player. Send them the code. |
  | no match runs, and both seats have players | Ready for the next match. |
  | the match is paused because both players are away ([1-6](1-rules.md)) | Paused: both players are away. |
  | the match is paused because SEAT is away | Paused: SEAT is away. The match goes on when they are back. |
  | this page is a spectator, and SEAT is to move | You are watching. SEAT to move. |
  | this page's seat SEAT is to move | Your turn. You are SEAT. |
  | this page's seat is SEAT, and OTHER is to move | You are SEAT. OTHER to move. |
