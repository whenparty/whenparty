# Games

A segment here is a part of the path made of lowercase letters, digits and hyphens.

- `4-1` On `games.when.party`, a path that starts with a segment `<name>` followed by `/` goes to the title in [`games/titles/<name>/`](/games/titles/AGENTS.md) with `/<name>` removed. The title gets the rest of the path decoded, normalized, with `.` and `..` resolved and repeated `/` merged, and encoded again: a character that a path must encode, such as a space or `?`, arrives encoded, and any other, `/` included, arrives as itself. The query reaches the title unchanged.
- `4-2` On `games.when.party`, a path of one segment without a trailing `/` answers 301 to the same path with `/` added, keeping the query.
- `4-3` On `games.when.party`, every other path goes to the [index page](/games/index/AGENTS.md).
- `4-4` On `games.when.party`, a 404, 502 or 504 on a path of `4-1` or `4-3`, whether a title, the index page or the proxy sends it, shows the games' 404 page with status 404 and `Cache-Control: no-store`. The proxy sends 502 for a path of `4-1` whose title has no running container, and for any path of `4-3` while the index page has none.
- `4-5` `signaling.when.party` goes to the [signaling server](/games/platform/signaling/AGENTS.md), and its responses keep their status and body. It answers 502 while the signaling server has no running container.
