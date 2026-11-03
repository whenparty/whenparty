# Hosting a title

Every title is served at `https://games.when.party/<name>/`, where `<name>` is its deployment name, such as `tictactoe`, made of lowercase letters, digits and hyphens. [game-hosts.md](/docs/decisions/game-hosts.md) explains why the titles share one host. The root of `games.when.party` is the [index page](../../index/AGENTS.md), and its own files are under `/_assets/`, which no `<name>` can be.

- `base` in the title's `vite.config.ts` is `/<name>/`, so the built pages load their files from that path. The dev and preview servers serve the title at the same path.
- Its `compose.yml` has a Traefik router `<name>` with the rule ``Host(`games.when.party`) && PathPrefix(`/<name>/`)`` and a `stripprefix` middleware `<name>-path` that removes `/<name>`, so the container serves the built files from its root. The server for the games in [games.conf](/infra/nginx/conf.d/games.conf) redirects `/<name>` to `/<name>/`, as [games-conf.md](/infra/docs/games-conf.md) says.
- `base`, the `PathPrefix` and the `stripprefix` prefix name the same `/<name>`. When one differs, the page or its files answer 404.
- A link to a page of the title stays under `/<name>/`, such as an invite link or the wordmark link. Write it relative to the page, such as `./`, or build it from `location.pathname` or `location.href`, not from the root of the host.
- The titles share one origin, and with it `localStorage` and `sessionStorage`. A storage key of a title starts with `<name>:`, such as `tictactoe:hosting`. The player ID that p2p keeps in `whenparty:player` is the same in every title.
- A new title needs no change outside `games/`.
- Through the proxy, every 404 of the title shows the games' 404 page, `errors/games-404.html`,. A title that needs its own changes `games.conf`, as [games-conf.md](/infra/docs/games-conf.md) says.
- The routers `tictactoe-old-host` and `calisthenics-old-host` redirect the former hosts `tictactoe.when.party` and `calisthenics.when.party` to the titles' paths, keeping the path and query. `games.conf` names these hosts too, as [games-conf.md](/infra/docs/games-conf.md) says. Removing a redirect deletes the router and its middleware from `compose.yml` and the host from `games.conf` in one change.
