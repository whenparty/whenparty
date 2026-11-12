# Status

- `3-1` The status in the room view ([2-3](2-page.md)) is the first row of this table that applies. The table lists only what tic-tac-toe can come to. The failures, the causes of the end of the game, "host away" and recovery are those of the netcode ([2-3, 2-4, 2-8 and 2-9](../../../../platform/docs/specs/2-game.md), [6-2](../../../../platform/docs/specs/6-recovery.md)), and players and spectators are as [2-6](../../../../platform/docs/specs/2-game.md) says. CODE, X and O stand for the room code and the seats in question.
  | When | Status |
  | --- | --- |
  | the game ended with "you left" | You left this game in another tab. |
  | the game ended, on the host's page | The game server lost this room, so the game is over. |
  | the game ended | The game is over: the host closed the room or did not come back. |
  | starting fails with "busy" | The game server is busy. Try again in a few minutes. |
  | entering fails with "no room" | Nobody hosts CODE. Check the code with the room creator. |
  | entering fails with "owner away" | The host of CODE is offline. Try again in a moment. |
  | entering fails with "full" | Room CODE is full. |
  | entering fails with "unreachable" | Found room CODE, but could not connect to its host. A network on the way blocks the connection. Try again in a moment, or switch between Wi-Fi and mobile data. |
  | starting or entering fails with "offline" | Cannot reach the game server. Check your internet connection. |
  | the game is being started | Creating a room… |
  | the game is being entered | Looking for room CODE… |
  | the page does not control its participant | This game is open in another tab of yours. |
  | the host recovers | The host is restoring the game… |
  | the page's participant is told "host away" | The host lost the connection. The game goes on when they are back. |
  | no match runs and a seat is free | Waiting for a second player. Send them the code. |
  | this page's seat won | You win! |
  | another seat won | X wins. |
  | the match is a draw | Draw. |
  | X left the match ([1-7](1-rules.md)) | X left, so the match is over. |
  | the match is paused because X is lost ([1-6](1-rules.md)) | Paused: X lost the connection. The match goes on when they are back. |
  | this page is a spectator | You are watching. X to move. |
  | this page's seat is to move | Your turn. You are X. |
  | the other seat is to move | You are X. O to move. |
- `3-2` After starting or entering fails, or the game ends, the room view stays until the leave button is pressed or the address changes as [2-6](2-page.md) says.
