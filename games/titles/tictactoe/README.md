# Tic-tac-toe

Peer-to-peer tic-tac-toe at `https://tictactoe.when.party`, built on [`@whenparty/p2p`](../../platform/p2p/README.md). Players find each other by a short room code, and the game state goes directly between their browsers.

## Playing

- **Create a room**: the page makes a code like `K7MXQ`. Read it out, or send the invite link (`https://tictactoe.when.party/#K7MXQ`).
- **Join**: type the code (case, spaces and dashes don't matter), or open the invite link, also in a tab that already shows the game.
- The creator is the host and plays X. The first to join plays O, and anyone else watches. When a game is over, either player can start a rematch.
- If the host leaves, the next player in the room takes over after a short pause and the game goes on. When a player leaves, the first spectator takes the free seat with the board as it was. With nobody watching, the next person to join takes it.
- A player whose connection drops keeps their seat for about 5 seconds, in case it comes back. A player who reloads or leaves frees it at once.
- "you host" next to the room code shows which tab hosts the room right now.

Everyone keeps the code in the URL (`#K7MXQ`), so a reload rejoins the room and takes a free seat, the host's too.

## Code Layout

```
src/
  tictactoe.ts        # the rules: a GameRules<TicTacToe, number> (pure)
  main.ts, style.css  # the page
  tests/              # node:test
index.html
vite.config.ts        # dev and preview servers send the production headers
```

The `appId` is `when.party/tictactoe`.

## Local Development

From `games/`, start the signaling server in one terminal:

```bash
npm install
npm start --workspace platform/signaling
```

and the game in another:

```bash
npm run dev --workspace titles/tictactoe
```

Open `http://localhost:5173` in two tabs, create a room in one and join it from the other. To check the host handover, add a third tab, close the host's tab, and watch the next player take over. Or reload the host's tab with two tabs: the guest takes over, and the reloaded tab comes back in the free seat.

The production image is built from the `games/` context:

```bash
docker build -f titles/tictactoe/Dockerfile -t tictactoe:dev .
docker run --rm -p 8081:80 tictactoe:dev
```

It is plain nginx serving `dist/`.

## Deployment

A push to `main` that changes this folder, `games/platform/p2p` or the workspace lockfile builds `ghcr.io/whenparty/tictactoe` and restarts the container (see [../../README.md](../../README.md)).
