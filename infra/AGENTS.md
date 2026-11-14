# infra

`infra/` is the [project](/docs/glossary.md#project) of the nginx proxy that terminates TLS for every site on the WhenParty VPS and passes each request to the site's container. It is one [deployment](/docs/glossary.md#deployment), which [infra.yml](/.github/workflows/infra.yml) deploys. It needs a [specification](/docs/conventions/specs.md).

- [docs/specs/](docs/specs/): what the proxy does for visitors, Cloudflare and the sites: connections, headers and limits, where each host goes, and the routing of the games.
- [verification.md](docs/verification.md): the smoke tests in `tests/` that check the specification, how to run them locally and what they need. Read it before changing `tests/` or running them.
- [nginx-configs.md](docs/nginx-configs.md): how the files in `nginx/conf.d/` combine the shared settings with a site's own, the shared 404 page and how a site replaces it, the default server of port 443, the address the health check calls, and how to check a change with `nginx -t`. Read it before changing `nginx/conf.d/`, or the image or the `healthcheck` of the nginx service in `docker-compose.yml`.
- [games-conf.md](docs/games-conf.md): which hosts `games.conf` names, how it reaches the containers of the games, the redirect to a title's path, the 404 page of the games, their Content-Security-Policy and the signaling limits. Read it before changing `games.conf` or `errors/games-404.html`.
- [sites.md](docs/sites.md): how the proxy reaches the container of each site, and how to add or remove a site. Read it before changing an upstream, the networks in `docker-compose.yml`, or the name of a container or network of a site.
- [The infra.yml section of deploys.md](/.github/docs/deploys.md#infrayml): what `infra.yml` does on the VPS and what the deploy leaves behind. Read it before changing `infra.yml` or removing a file from `infra/`.
- [cloudflare-ip-list.md](docs/cloudflare-ip-list.md): the list of Cloudflare addresses that nginx trusts for the client's address, and the hourly job that refreshes it. Read it before changing `scripts/` or the real IP settings in `default.conf`.
- [setup.md](docs/setup.md): what the proxy needs on the VPS and in Cloudflare: folders, certificates and zone settings. Read it before setting up a VPS or a new domain, or replacing a certificate.
- [troubleshooting.md](docs/troubleshooting.md): what to check on the VPS when a site fails.
- [decisions/default-server.md](docs/decisions/default-server.md): why the default server of port 443 refuses the handshake, and why it lives in `default.conf`.
- [decisions/proxy-tests.md](docs/decisions/proxy-tests.md): why `check-nginx.yml` runs the smoke tests, so that a deploy of `infra/` waits for them.
- [game-hosts.md](/docs/decisions/game-hosts.md): why the games share the host `games.when.party` and have `games.conf` apart from the temporary sites.
- [games-routing.md](/docs/decisions/games-routing.md): why nginx passes each title to its container by the first segment of the path, without Traefik.
- [former-game-hosts.md](/docs/decisions/former-game-hosts.md): why `games.conf` names no former host of a title and redirects none.
- [/temp-sites/docs/decisions/routing.md](/temp-sites/docs/decisions/routing.md): why `temp-sites.conf` passes the temporary sites to Traefik, not to their containers.

Requirements of other specifications that rely on `infra/`:

- [`1-4`](/games/index/docs/specs/1-catalog.md) of the index page relies on [`4-4`](docs/specs/4-games.md).
