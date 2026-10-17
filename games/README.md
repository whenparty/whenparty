# Games

Peer-to-peer browser games on `*.when.party`, and the platform they share. Players find each other by a short room code. The game state goes directly between their browsers over WebRTC data channels ([Trystero](https://github.com/dmotz/trystero)) and is never stored on a server.

```
signaling:   browser → wss://signaling.when.party ← browser   (only to find each other)
game state:  browser ⇄ WebRTC data channel ⇄ browser
```

## Layout

```
games/
  package.json, package-lock.json   # one npm workspace, one lockfile
  platform/                         # what the games share
    signaling/                      # Trystero signaling server, signaling.when.party
  titles/                           # one folder per game
```

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
