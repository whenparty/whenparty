# Catalog

- `1-1` The root of `games.when.party` shows a page with an entry for every game that [titles/AGENTS.md](../../../titles/AGENTS.md) lists, and no other entries. Each entry shows the game's name, such as Tic-tac-toe, a description of one sentence and a picture of the game.
- `1-2` Each entry links to `/<name>/` on the page's own host, where `<name>` is the game's folder in `titles/`.
- `1-3` The HTML that the server returns holds every entry and its link, and the page loads no script of its own. It sets no cookies and writes nothing to `localStorage` or `sessionStorage`.
- `1-4` A path on `games.when.party` that neither the page nor a game serves answers 404.
