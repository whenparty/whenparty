# Games

Peer-to-peer browser games on `*.when.party`, and the platform they share. Players find each other by a short room code. The game state goes directly between their browsers over WebRTC data channels ([Trystero](https://github.com/dmotz/trystero)) and is never stored on a server.

```
signaling:   browser → wss://signaling.when.party ← browser   (only to find each other)
game state:  browser ⇄ WebRTC data channel ⇄ browser
             browser ⇄ turn.when.party ⇄ browser             (only when they can't connect directly)
```

## Layout

```
games/
  package.json, package-lock.json   # one npm workspace, one lockfile: vite, typescript, Trystero
  tsconfig.base.json
  platform/                         # what the games share
    p2p/                            # client library: room codes, host-authoritative rooms, Trystero sessions
    signaling/                      # Trystero signaling server, signaling.when.party
    turn/                           # coturn, turn.when.party: relays for browsers that can't connect directly
  titles/                           # one folder per game
    tictactoe/                      # tictactoe.when.party
```

See [platform/p2p/README.md](platform/p2p/README.md) for how a game connects and syncs its state.

A folder in `platform/` or `titles/` with a `compose.yml` is a deployed project. It runs from `/opt/services/whenparty/games/<group>/<name>` on the VPS. Like a temp site, its image (`ghcr.io/whenparty/<name>`), container and Traefik router are named after the folder, and only its compose project gets a prefix (`games-<name>`). Those names share one namespace with `temp-sites/projects/`, so `games.yml` stops if a name is used twice.

Games use the temp-sites infrastructure: the Traefik router on the `wp_tempsites` network, and the `*.when.party` nginx config with its CSP (`infra/nginx/conf.d/temp-sites.conf`).

## Deployment

On a push to `main` that changes `games/**` (Markdown excluded), `.github/workflows/games.yml`:

1. runs `npm ci`, `npm test` and `npm run typecheck` for the whole workspace in `node:24.22.0-alpine3.24`. Nothing deploys if they fail.
2. finds the projects the change reaches:
   - a file in a project: that project
   - a file in a platform library without `compose.yml`: every title
   - a file at the top of `games/` (`package.json`, `package-lock.json`): every project
3. deploys each one with `.github/workflows/deploy-project.yml`, building its `Dockerfile` with `games/` as the context. A deleted project is taken down.

Every Dockerfile is built from the `games/` context, so it can use the workspace lockfile. `games/.dockerignore` keeps `node_modules`, `dist`, tests and Markdown out of it.

## Local Development

```bash
cd games
npm install
npm test
npm run typecheck
```

To play locally, run the signaling server (`npm start --workspace platform/signaling`) and a title (`npm run dev --workspace titles/tictactoe`), then open the page in two tabs. Pages on `localhost` connect to `ws://localhost:8080`.

## Adding a Game

1. Copy `titles/tictactoe/` to `titles/<game>/`, without `node_modules` and `dist`.
2. Rename: `name` in `package.json`, every `tictactoe` in `compose.yml` and `Dockerfile` (the compose project keeps its `games-` prefix), the host, and the `appId` in `src/main.ts`. The name must not be taken by another game or a temp site.
3. Replace `src/tictactoe.ts` and its tests with your rules, a `GameRules<State, Move>` from `@whenparty/p2p`.
4. Rewrite `index.html`, `src/main.ts` and `src/style.css` for your game.
5. Run `npm install` in `games/` so the lockfile knows the new workspace.

The first push deploys it as `ghcr.io/whenparty/<game>`.
