# Former game hosts

## Context

`tictactoe` and `calisthenics` had hosts of their own, `tictactoe.when.party` and `calisthenics.when.party`, for less than three weeks, until [game-hosts.md](/docs/decisions/game-hosts.md) put every title under a path of `games.when.party` on 3 November 2026. From then until the games left Traefik, labels in the titles' compose files redirected these hosts to the titles' paths with a 301, keeping the path and query, and browsers cache such a redirect. [games-routing.md](/docs/decisions/games-routing.md) takes the games off Traefik, so these labels went with it, and no title has routes of its own.

A host that no server of nginx names falls to the wildcard server of `temp-sites.conf`. Traefik finds no router for it and answers 418, which nginx shows as its page for unknown hosts with status 404, as [nginx-configs.md](/infra/docs/nginx-configs.md) says.

A title builds its invite links from the address of its page, as [hosting.md](/games/titles/docs/hosting.md) says, so every invite link to a former host was made before 3 November 2026. A room closes soon after its creator leaves, as [STATES.md](/games/platform/p2p/STATES.md) says.

## Options

- The previous setup: a Traefik router in each title's compose file redirects its former host to its path, and `games.conf` names the host. Bookmarks and old links keep working. Once the games leave Traefik, these routers can stay only in a compose file of `temp-sites/`, such as Traefik's own, which then holds routes of another project's titles.
- A server in `games.conf` redirects the former hosts to the titles' paths. Bookmarks and old links keep working. `games.conf` holds lines for single titles, which no new title adds, and a title that is renamed or removed changes `infra/`.
- No redirects. The former hosts get the page for unknown hosts. Nothing to keep in step. A bookmark or an old link to a title's start page shows the page for unknown hosts, unless the browser has cached the redirect.

## Decision

No redirects. They would keep only the bookmarks and links to a title's start page working that were made in the less than three weeks that the former hosts served the titles, because every invite link to a former host names a room that has closed. Against a server in `games.conf`, `games.conf` names only the hosts that serve the games, and a title changes nothing outside `games/`. Against routers in `temp-sites/`, that project holds nothing of the games.

## Consequences

- [games.conf](/infra/nginx/conf.d/games.conf), [games-conf.md](/infra/docs/games-conf.md) and [nginx-configs.md](/infra/docs/nginx-configs.md).
- [hosting.md](/games/titles/docs/hosting.md) and [names.md](/temp-sites/docs/names.md).
