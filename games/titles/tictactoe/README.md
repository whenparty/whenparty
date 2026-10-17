# Tic-tac-toe

Peer-to-peer tic-tac-toe at `https://tictactoe.when.party`, built on [`@whenparty/p2p`](../../platform/p2p/README.md). Players find each other by a short room code, and the game state goes directly between their browsers.

## Playing

- **Create a room**: the page makes a code like `K7MXQ`. Read it out, or send the invite link (`https://tictactoe.when.party/#K7MXQ`).
- **Join**: type the code (case, spaces and dashes don't matter), or open the invite link.
- The creator is the host and plays X. The first to join plays O, and anyone else watches. When a game is over, either player can start a rematch.
- If the host leaves, the game is over. A guest who reloads gets their seat and the board back.

Guests keep the code in the URL (`#K7MXQ`), so a reload rejoins the room. The host doesn't, because a reload ends the host's game.

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

Open `http://localhost:5173` in two tabs, create a room in one and join it from the other.

The production image is built from the `games/` context:

```bash
docker build -f titles/tictactoe/Dockerfile -t tictactoe:dev .
docker run --rm -p 8081:80 tictactoe:dev
```

It is plain nginx serving `dist/`.

## Deployment

A push to `main` that changes this folder, `games/platform/p2p` or the workspace lockfile builds `ghcr.io/whenparty/tictactoe` and restarts the container (see [../../README.md](../../README.md)).
