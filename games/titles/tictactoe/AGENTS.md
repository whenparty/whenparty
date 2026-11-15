# Tic-tac-toe

`tictactoe/` is the tic-tac-toe game of [titles](../AGENTS.md), for two players and anyone who watches. It plays through the [netcode module](../../platform/netcode/AGENTS.md) of the platform. [src/tictactoe.ts](src/tictactoe.ts) holds its rules, [src/page.ts](src/page.ts) its page, [src/status.ts](src/status.ts) the texts of its status, and [src/main.ts](src/main.ts) binds the page to the document; the deployment uses `compose.yml` and `Dockerfile`.

- [docs/specs/](docs/specs/): its specification of its rules, its page and what the page shows.
