# Tic-tac-toe

Peer-to-peer tic-tac-toe at `https://tictactoe.when.party`, built on [`@whenparty/p2p`](../../platform/p2p/README.md). Players find each other by a short room code, and the game state goes directly between their browsers.

## Playing

- **Create a room**: the page makes a code like `K7MXQ`. Read it out, or send the invite link (`https://tictactoe.when.party/#K7MXQ`).
- **Join**: type the code (case, spaces and dashes don't matter), or open the invite link, also in a tab that already shows the game.
- The creator is the host and plays X. The first to join plays O, and anyone else watches. When a game is over, either player can start a rematch.
- If the host leaves, the next player in the room takes over and the game goes on: at once when the host leaves with the button, after a short pause when it closes or reloads its tab or its connection drops. A host that reloads comes back as a player, in its seat. When a player leaves, the first spectator takes the free seat with the board as it was. With nobody watching, the next person to join takes it.
- A player whose connection drops keeps their seat for about 5 seconds, in case it comes back. A player who switched away first (another app, the screen off) keeps it for 2 minutes: phones freeze hidden pages, and their connections drop. If that player hosted, the next player takes over meanwhile so the others can go on. A player who leaves with the button frees the seat at once; one who reloads comes back to it.
- "you host" next to the room code shows which tab hosts the room right now.

Everyone keeps the code in the URL (`#K7MXQ`), so a reload rejoins the room as the same player, in the same seat: the browser keeps a player ID in `localStorage`. The room opened in a second tab moves the seat to that tab, and the first one says so and only watches. A host alone in its room hosts it again after a reload, with a new game: the tab keeps the code it hosts in `sessionStorage`.

A guest that hears from no host within 10 seconds sees why: the code may be wrong, the game server may be out of reach, or the network may block direct connections to the players in the room. When nobody hosts the code, a "Start room K7MXQ" button starts it. It is a button and not automatic, so a mistyped code doesn't silently start an empty room. If the room was there after all and the tab just could not reach it yet, that room wins when they meet, and the started one folds into it with the game as it was.

## Code Layout

```
src/
  tictactoe.ts        # the rules: a GameRules<TicTacToe, number> (pure)
  search.ts           # what the page says while it looks for its room, and when it offers to start it (pure)
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

Open `http://localhost:5173` in two tabs, create a room in one and join it from the other. To check the host handover, add a third tab, close the host's tab, and watch the next player take over. Or reload the host's tab with two tabs: the guest takes over, and the reloaded tab comes back in its seat. Open the room's link in a third tab of the same browser: the seat moves there. Reload a host that is alone in its room: after about 5 seconds it hosts again. Stop the signaling server and join a room: after 10 seconds the page says it can't reach the game server, and once the server is back, that nobody hosts the code.

The production image is built from the `games/` context:

```bash
docker build -f titles/tictactoe/Dockerfile -t tictactoe:dev .
docker run --rm -p 8081:80 tictactoe:dev
```

It is plain nginx serving `dist/`.

## Deployment

A push to `main` that changes this folder, `games/platform/p2p` or the workspace lockfile builds `ghcr.io/whenparty/tictactoe` and restarts the container (see [../../README.md](../../README.md)).
