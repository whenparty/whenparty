# Game hosts

## Context

The games and their signaling server run behind the Traefik router of `temp-sites/`, on hosts one level below `when.party`, such as `tictactoe.when.party` and `signaling.when.party`. The Traefik labels in each `compose.yml` in `games/` set the hosts. The games need a Content-Security-Policy that lets them reach the signaling server, and the signaling server needs limits of its own. The temporary sites need neither. nginx picks a server with an exact `server_name` before one with a wildcard, and among wildcards the longest, and `temp-sites.conf` has a `*.when.party` wildcard server for the temporary sites.

Cloudflare's free edge certificate covers `when.party` and the hosts one level below it. A host two levels below, such as `tictactoe.games.when.party`, needs Cloudflare's paid Advanced Certificate Manager and an origin certificate that names the deeper wildcard. The other way to serve such a host is a DNS record that Cloudflare does not proxy. Such a host loses Cloudflare's proxy and Authenticated Origin Pulls, which [setup.md](/infra/docs/setup.md#cloudflare) describes, needs a certificate that browsers trust, and needs a server that turns off the `ssl_verify_client` of `default.conf`.

This record chooses how the games' hosts are named and served while each game keeps a host of its own. Whether to put every game on one host is undecided, as the [open questions](/docs/open-questions.md#games-on-one-host) say.

## Options

- The previous setup: the games under the wildcard server of `temp-sites.conf`, and the signaling server in a server of its own in the same file. Nothing to maintain for a new game. The temporary sites get the games' access to the signaling server, a change to the policy of one applies to the other, and the config of the temporary sites holds the signaling server.
- Games on `*.games.when.party` with a wildcard server of their own, and the temporary sites on `*.when.party` or moved to `*.ts.when.party`. The host name tells which kind a site is, and no list of hosts is needed. It costs Advanced Certificate Manager and a new origin certificate, or Cloudflare's proxy and Authenticated Origin Pulls, and changes the address of every game.
- The current hosts, with the games and the signaling server in `games.conf` and their hosts named exactly there. Addresses, DNS records, certificates and costs stay as they are. The list of game hosts in `games.conf` has to match the games, which [game-hosts-check.md](/docs/decisions/game-hosts-check.md) decides how to keep.
- Hosts with a prefix one level below `when.party`, such as `game-calisthenics.when.party`, matched by a regular expression in `server_name`. No list of hosts and no new certificate. Every game changes its address.

## Decision

The current hosts with the games in `games.conf`. Against the previous setup, it gives the games their own Content-Security-Policy and takes the signaling server out of the temporary sites' config, at the cost of a list of hosts that a check keeps in sync. Against the layouts on `*.games.when.party` and with a prefix, it keeps every address, DNS record and certificate. Both of those change every game's address, and the first also costs Advanced Certificate Manager or Cloudflare's proxy.

## Consequences

- [games.conf](/infra/nginx/conf.d/games.conf) and [temp-sites.conf](/infra/nginx/conf.d/temp-sites.conf).
- [Games and signaling in nginx-configs.md](/infra/docs/nginx-configs.md#games-and-signaling).
