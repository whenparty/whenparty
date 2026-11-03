# Titles

Each folder here is one game:

- [tictactoe](tictactoe/AGENTS.md): tic-tac-toe for two players.
- [calisthenics](calisthenics/AGENTS.md): a street workout championship.

[docs/hosting.md](docs/hosting.md): the path each title is served at on `games.when.party`, and what its `vite.config.ts`, `compose.yml`, links and storage keys need for it. [game-hosts.md](/docs/decisions/game-hosts.md): why the titles share one host. Read both, and the [Games and signaling](/infra/docs/nginx-configs.md#games-and-signaling) section of nginx-configs.md, before adding a title or changing where a title is served.

A new title also gets an entry on the [index page](../index/AGENTS.md). Keep title-specific decisions inside the title. Each title needs a unique `appId` and deployment name.
