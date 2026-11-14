# Hosting a title

Every title is served at `https://games.when.party/<name>/`, where `<name>` is its deployment name, such as `tictactoe`, made of lowercase letters, digits and hyphens. [game-hosts.md](/docs/decisions/game-hosts.md) explains why the titles share one host. The root of `games.when.party` is the [index page](../../index/AGENTS.md), and its own files are under `/_assets/`, which no `<name>` can be.

- `base` in the title's `vite.config.ts` is `/<name>/`, so the built pages load their files from that path. The dev and preview servers serve the title at the same path.
- Its `compose.yml` names its container `games-<name>` and joins the external network `wp_games`, and sets no other name or network alias. The container listens on port 80. The proxy passes `/<name>/` to that container with `/<name>` removed, so the container serves the built files from its root, and redirects `/<name>` to `/<name>/`, as requirements `4-1` and `4-2` of the [proxy's specification](/infra/docs/specs/4-games.md) say. [check-game-names.yml](/.github/workflows/check-game-names.yml) checks the name and the network, as [checks.md](/.github/docs/checks.md#the-checks) says.
- `base` and the container name name the same `<name>`. When they differ, the page or its files answer 404.
- A link to a page of the title stays under `/<name>/`, such as an invite link or the wordmark link. Write it relative to the page, such as `./`, or build it from `location.pathname` or `location.href`, not from the root of the host.
- The titles share one origin, and with it `localStorage` and `sessionStorage`. A storage key of a title starts with `<name>:`, such as `tictactoe:hosting`. The player ID that p2p keeps in `whenparty:player` is the same in every title.
- A new title needs no change outside `games/`.
- Through the proxy, the games' 404 page, `errors/games-404.html`, replaces the title's 404s and shows while its container is down, as requirement `4-4` of the [proxy's specification](/infra/docs/specs/4-games.md) says. A title that needs its own changes `games.conf`, as [games-conf.md](/infra/docs/games-conf.md) says.
