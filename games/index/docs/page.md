# Working on the index page

## Files

- [index.html](../index.html) holds the page and one entry for each game, as [1-catalog.md](specs/1-catalog.md) says. A new entry copies an existing `<li class="game">`, because the tests find an entry's name in its `<h2>` and its description in its first `<p>`, and its `<img>` gives the picture's width and height.
- [src/images/](../src/images/) holds the pictures, one per game, named after its folder in `titles/`, as JPEG at 16:10, such as a screenshot of the game in play. It also holds the favicon.
- [src/styles.css](../src/styles.css) holds the look: its colours as custom properties, with a light and a dark theme that follows the browser's setting, its fonts and its hand-drawn corners. A change to its colours or fonts also changes the proxy's 404 page, as [games-conf.md](/infra/docs/games-conf.md) says.
- Vite builds the page and puts the files it loads under `/_assets/`, which no game's path can be, as [hosting.md](../../titles/docs/hosting.md) says.

## Routing

The Traefik router `index` in [compose.yml](../compose.yml) matches every path of `games.when.party`. Traefik prefers the longer rule of a title's router, so the page gets only the paths that no title matches, and its nginx answers 404 for those it has no file for. The proxy then replaces the body of that 404 with its own page, as [games-conf.md](/infra/docs/games-conf.md) says.

## Adding a game

A new title adds its entry to `index.html` and its picture to `src/images/`. The page's tests compare the entries with the list in [titles/AGENTS.md](../../titles/AGENTS.md). A new title changes `pnpm-lock.yaml`, so its pull request runs them. A change only to `titles/AGENTS.md` runs no tests, as [games-changes.md](/.github/docs/games-changes.md) says.
