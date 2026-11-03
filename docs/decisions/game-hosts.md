# Game hosts

## Context

The games and their signaling server run behind the Traefik router of `temp-sites/`. The Traefik labels in each `compose.yml` in `games/` set the host of a deployment and, for a title, its path. The games need a Content-Security-Policy that lets them reach the signaling server, and the signaling server needs limits of its own. The temporary sites need neither. nginx picks a server with an exact `server_name` before one with a wildcard, and among wildcards the longest, and `temp-sites.conf` has a `*.when.party` wildcard server for the temporary sites.

Cloudflare's free edge certificate covers `when.party` and the hosts one level below it. A host two levels below, such as `tictactoe.games.when.party`, needs Cloudflare's paid Advanced Certificate Manager and an origin certificate that names the deeper wildcard. The other way to serve such a host is a DNS record that Cloudflare does not proxy. Such a host loses Cloudflare's proxy and Authenticated Origin Pulls, which [setup.md](/infra/docs/setup.md#cloudflare) describes, needs a certificate that browsers trust, and needs a server that turns off the `ssl_verify_client` of `default.conf`. A host that no wildcard DNS record covers needs a record of its own in Cloudflare, which nothing in the repository creates.

Pages on one host share an origin, and with it `localStorage` and `sessionStorage`. Pages under a path need that path in the URLs of their files, which Vite's `base` sets, and a link that starts at the root of the host leaves the game. The signaling server allows pages on `when.party` and every host below it. TURN traffic does not pass through nginx, so `turn.when.party` keeps a host of its own in every layout.

## Options

- Each game on a host of its own under the wildcard server of `temp-sites.conf`, and the signaling server in a server of its own in the same file. Nothing to maintain for a new game. The temporary sites get the games' access to the signaling server, a change to the policy of one applies to the other, and the config of the temporary sites holds the signaling server.
- The previous decision: each game on a host of its own one level below `when.party`, such as `tictactoe.when.party`, named exactly in a server of `games.conf`, with the signaling server in another. Each game has an origin of its own and is served from the root of its host. Every new game adds a host to `games.conf`, which [game-hosts-check.md](/docs/decisions/game-hosts-check.md) keeps in sync, and a DNS record unless a wildcard covers it.
- Games on `*.games.when.party` with a wildcard server of their own. The host name tells which kind a site is, and no list of hosts is needed. It costs Advanced Certificate Manager and a new origin certificate, or Cloudflare's proxy and Authenticated Origin Pulls.
- Hosts with a prefix one level below `when.party`, such as `game-calisthenics.when.party`, matched by a regular expression in `server_name`. No list of hosts, no new certificate, and an origin for each game. A new game still needs a DNS record unless a wildcard covers it, and [check-game-hosts.yml](/.github/workflows/check-game-hosts.yml) compares exact `server_name` entries, so it would fail on a regular expression.
- Every game on `games.when.party` under a path of its own, such as `/tictactoe/`, in one server of `games.conf`. A new game adds no host, server or DNS record. Each title sets `base`, routes by host and path, keeps the path in the links it builds, and names its storage keys after itself. The games' earlier hosts need redirects.

## Decision

Every game on `games.when.party` under a path of its own. A new game needs no change outside `games/`: no host in `games.conf`, no DNS record and no certificate. Against hosts of their own and hosts with a prefix, the games give up an origin each. That costs little, because every game is code from this repository, so no game needs protection from another, and storage keys named after the game keep the games' data apart. Against hosts with a prefix, it also needs no change to the host check. Against the wildcard server of the temporary sites, it keeps the games' own Content-Security-Policy and keeps the signaling server out of the temporary sites' config. Against `*.games.when.party`, it needs no Advanced Certificate Manager and keeps Cloudflare's proxy.

## Consequences

- [games.conf](/infra/nginx/conf.d/games.conf) and [temp-sites.conf](/infra/nginx/conf.d/temp-sites.conf).
- [games-conf.md](/infra/docs/games-conf.md).
- [hosting.md](/games/titles/docs/hosting.md).
