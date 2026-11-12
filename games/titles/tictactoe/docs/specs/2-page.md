# Page

- `2-1` When a person opens the page at an address whose part after `#` the netcode does not turn into a room code ([2-4](../../../../platform/docs/specs/2-game.md)), the page shows the lobby: a button that starts a game and a form that enters one by its room code.
- `2-2` When a person submits the form with text that the netcode does not turn into a room code, the form shows: "That is not a room code. Codes have 5 characters, like K7MXQ."
- `2-3` When a person starts or enters a game, the page shows the room view: the status ([3-1](3-status.md)), "you host" on the host's page, the board and a button that leaves the game. Once the netcode tells the page the room code ([2-3](../../../../platform/docs/specs/2-game.md)), or once the page entered by a code, the view also shows the code and a button that copies the invite link.
- `2-4` Once the room view shows a code, the page's address ends in `#` and the code, and the invite link is that address.
- `2-5` When a person opens the page at an address whose part after `#` the netcode turns into a room code, the page enters that game and puts the code into the address in the form that the netcode returns.
- `2-6` When the part of the address after `#` changes to text that the netcode does not turn into the code of the page's game, the page leaves the game, or ends it on the host's page ([2-7](../../../../platform/docs/specs/2-game.md)). Then it enters the game of the new code or, when the new text is not a room code, shows the lobby.
- `2-7` When a person presses the leave button, the page leaves the game, or ends it on the host's page, shows the lobby and removes the code from the address.
- `2-8` When a mark wins, its winning cells ([1-4](1-rules.md)) have a colour that no other cell has, until the next match starts.
- `2-9` When the page can act ([4-1](../../../../platform/docs/specs/4-actions.md)), its seat is to move and the cell is empty, clicking the cell makes the move. Otherwise clicking a cell does nothing.
- `2-10` When both seats have players and no match has started yet, the host's page starts the first match. When a match is over, the host's page shows a button that starts the next one when both seats have players ([5-4](../../../../platform/docs/specs/5-matches.md)).
