# How the proxy reaches the sites

Each site config in `nginx/conf.d/` passes requests to an `upstream`. Each upstream names a container from `www/`, `nii-au/` or `temp-sites/traefik/docker-compose.yml`, on a network they share with nginx. The upstream uses the container name in the site's compose file, which joins the network as an external one. Renaming a container or network, or changing the port a backend listens on, changes both sides in the same change. `temp-sites.conf` and `games.conf` each have an upstream that names the Traefik router, so each file is complete without the other. Every upstream marks its server `resolve`, so nginx looks the container up in Docker's DNS while it runs, and a stopped container does not keep nginx from starting or reloading. [setup.md](setup.md#vps) says which deploy creates the networks.

Traefik routes each `*.when.party` host to a temporary site or game container by the labels in its compose file. A new temporary site needs no change here. A new title needs no change here either, because every title is on `games.when.party`. A deployment of `games/` on a host of its own adds or removes that host in `games.conf`, as [nginx-configs.md](nginx-configs.md#games-and-signaling) says.

When nginx cannot reach a backend, the site answers 502: its container is down or is not on the network. [troubleshooting.md](troubleshooting.md) says how to check.

## Adding a site

A site on its own host name gets a config file in `nginx/conf.d/` with its `server` blocks, certificates, Content-Security-Policy and upstream, as [nginx-configs.md](nginx-configs.md) describes. When its container is on a new network, `docker-compose.yml` attaches nginx to it as an external network. Then add the new network to the networks that [infra.yml creates](/.github/docs/deploys.md#infrayml).

A new domain also needs its certificates on the VPS and its Cloudflare settings, as [setup.md](setup.md) says, and its certificate name in `check-nginx.yml`, as [checks.md](/.github/docs/checks.md#the-checks) says.

## Removing a site

Delete its config from `nginx/conf.d/`, and delete the file on the VPS too, because the deploy never deletes files there, as [deploys.md](/.github/docs/deploys.md#infrayml) says.
