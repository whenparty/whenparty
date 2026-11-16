# Titles

Each folder here is one game:

- [tictactoe](tictactoe/AGENTS.md): tic-tac-toe for two players.
- [calisthenics](calisthenics/AGENTS.md): a street workout championship.

[docs/hosting.md](docs/hosting.md): the path each title is served at on `games.when.party`, what its `vite.config.ts`, `compose.yml`, links and storage keys need for it, and why its app ID differs from every other title's. [game-hosts.md](/docs/decisions/game-hosts.md): why the titles share one host. [games-routing.md](/docs/decisions/games-routing.md): why nginx finds a title's container by its path. [former-game-hosts.md](/docs/decisions/former-game-hosts.md): why a title's former host is not redirected. Read hosting.md and game-hosts.md, and [games-conf.md](/infra/docs/games-conf.md), before adding a title or changing where a title is served. [page.md](../index/docs/page.md#adding-a-game) of the index page says what a new title adds there.
