# Rules

- `1-1` The game plays through the platform's netcode ([2-1](../../../../platform/docs/specs/2-game.md)) with the app ID `when.party/tictactoe`, a waiting time of 600 seconds and two seats, X and O. Each match starts with an empty board of three rows of three cells, with X to move.
- `1-2` When the player on the seat to move marks an empty cell while the match is not over and not paused, the cell gets the seat's mark, and the other seat is to move.
- `1-3` A move made for another board than the match's current one, such as one made before the other player's last move arrived, is refused, and so is every move that 1-2 does not allow.
- `1-4` When the three cells of a row, a column or a diagonal hold the same mark, that mark wins and the match is over. The cells of every such line are the winning cells.
- `1-5` When the board is full and no mark has won, the match is a draw and is over.
- `1-6` While a player of the match is lost ([5-5](../../../../platform/docs/specs/5-matches.md)), the match is paused. When the player is back, it goes on with the same board and the same seat to move.
- `1-7` When a player leaves while the match is not over, the match is over without a winner, and the seat that left is known.
- `1-8` A match can start only when both seats have players.
