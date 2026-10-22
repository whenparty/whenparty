# Tic-tac-toe

[src/tictactoe.ts](src/tictactoe.ts) owns match rules; `src/main.ts` owns the page. Use the shared [P2P platform](../../platform/p2p/AGENTS.md) for connections and participant lifecycle.

X and O are admitted players; additional visitors watch. A match starts when both seats are occupied, before the first move. Its participants stay fixed.

The match pauses on `lost` and resumes on `back` with the same board and turn. `left` ends it without a winner. Finished matches stay finished; a replacement may take a free seat for an explicit rematch once both seats are occupied. The room's lifetime follows the [platform rules](../../platform/p2p/STATES.md).

[Game tests](src/tests/tictactoe.test.ts) cover rules; [lifecycle tests](src/tests/lifecycle.test.ts) check their public platform contract. The production `appId` is `when.party/tictactoe`; deployment uses `compose.yml` and `Dockerfile`.
