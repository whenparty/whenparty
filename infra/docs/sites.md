# How the proxy reaches the sites

Each site config in `nginx/conf.d/` passes requests to an `upstream`. Each upstream names a container from `www/`, `nii-au/`, `games/` or `temp-sites/traefik/docker-compose.yml`, on a network they share with nginx: `wp_www`, `wp_games` or `wp_tempsites`. The upstream uses the container name in the site's compose file, which joins the network as an external one. Renaming a container or network, or changing the port a backend listens on, changes both sides in the same change. Every upstream marks its server `resolve`, so nginx looks the container up in Docker's DNS while it runs, and a stopped container does not keep nginx from starting or reloading. [setup.md](setup.md#vps) says which deploy creates the networks.

The server for the games in `games.conf` also builds a container name from the path, `games-<name>`, and looks it up in Docker's DNS at each request, as [games-conf.md](games-conf.md) says. So a new title needs no change here. Docker's DNS answers for every network nginx is on, so a container on any of them can take a name that nginx looks up, which [check-game-names.yml](/.github/workflows/check-game-names.yml) prevents. nginx keeps every answer for 5 seconds, the `valid` time of the `resolver` in `default.conf`, so after a deploy gives a container a new address, requests to it can fail for that long. It waits at most 5 seconds for an answer, the `resolver_timeout` there, because Docker's DNS passes a name it does not know to the VPS's own resolvers.

Traefik routes each `*.when.party` host that no other config names to a temporary site's container by the labels in its compose file. A new temporary site needs no change here. A deployment of `games/` on a host of its own adds a server for that host in `games.conf`.

When nginx cannot reach a backend, the site answers 502: its container is down or is not on the network. The server for the games shows its 404 page instead, as games-conf.md says. [troubleshooting.md](troubleshooting.md) says how to check.

## Adding a site

A site on its own host name gets a config file in `nginx/conf.d/` with its `server` blocks, certificates, Content-Security-Policy and upstream, as [nginx-configs.md](nginx-configs.md) describes. When its container is on a new network, `docker-compose.yml` attaches nginx to it as an external network. Then add the new network to the networks that [infra.yml creates](/.github/docs/deploys.md#infrayml).

A new domain also needs its certificates on the VPS and its Cloudflare settings, as [setup.md](setup.md) says, and its certificate name in `check-nginx.yml`, as [checks.md](/.github/docs/checks.md#the-checks) says.

## Removing a site

Delete its config from `nginx/conf.d/`, and delete the file on the VPS too, because the deploy never deletes files there, as [deploys.md](/.github/docs/deploys.md#infrayml) says.
