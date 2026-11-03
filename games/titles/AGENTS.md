# Titles

Each folder here is one game:

- [tictactoe](tictactoe/AGENTS.md): tic-tac-toe for two players.
- [calisthenics](calisthenics/AGENTS.md): a street workout championship.

[game-hosts.md](/docs/decisions/game-hosts.md): why each title keeps a host of its own that [games.conf](/infra/nginx/conf.d/games.conf) names. Read it, and the [Games and signaling](/infra/docs/nginx-configs.md#games-and-signaling) section of nginx-configs.md, before adding a title or changing a title's host.

Keep title-specific decisions inside the title. Each title needs a unique `appId` and deployment name.
