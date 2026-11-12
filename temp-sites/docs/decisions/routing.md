# Routing of the temporary sites

## Context

The temporary sites are small sites that live for a while, each at the root of a host of its own, `<name>.when.party`. The Traefik router of `temp-sites/` passes each host to its site's container by the labels in the site's compose file, as [traefik.md](../traefik.md) says. Traefik mounts the Docker socket, so whoever controls it controls Docker on the VPS, and every deploy of it interrupts the sites for a few seconds. Any container on the VPS with Traefik labels can claim any host, another site's included.

[games-routing.md](/docs/decisions/games-routing.md) takes the games off this router: nginx finds their containers in Docker's DNS by a name that it builds from the request, a check in CI keeps other containers off those names, and a redeployed container can fail for the resolver's `valid` time. nginx could find the container of a temporary site the same way, from its host.

Sites on one host share an origin, and with it cookies, `localStorage` and service workers, and each of them has to work under its path. [game-hosts.md](/docs/decisions/game-hosts.md) accepts this for the games, so that a new title needs no DNS record. A new temporary site needs a DNS record unless a wildcard covers it, as [names.md](../names.md#hosts) says.

## Options

- Traefik routes each host to its site by the site's labels. Nothing changes, and a site can have routes of its own. Traefik keeps mounting the Docker socket, every deploy of Traefik interrupts the sites, and a site's labels can take another site's host.
- nginx routes each host to the container `tmp-<name>`, and Traefik goes. One way of routing for every site on the VPS, and no Docker socket. It changes `temp-sites/`, its deploys and every site's compose file, needs a check for `tmp-` names, a redeployed site can fail for the resolver's `valid` time, and no site has routes of its own.
- The sites move to `tmp.when.party/<name>/`, routed like the games. One host and one way of routing for every site, and a new site needs no DNS record. The sites share one origin, each has to work under a path, and their current hosts stop working.

## Decision

Traefik keeps routing the temporary sites by host. Only the temporary sites use Traefik, so moving them to nginx would remove Traefik and its Docker socket and leave one way of routing. That does not outweigh changing `temp-sites/`, its deploys and every site, which work as they are. Traefik keeps mounting the Docker socket, as before. Its deploys, and labels that take another site's host, now reach only the temporary sites, which live for a while, and no longer the games. Against `tmp.when.party`, each site keeps the root of a host of its own, and with it an origin of its own, and works as any site does, which outweighs a DNS record for each new site.

## Consequences

- [traefik.md](../traefik.md), [sites.md](../sites.md) and [traefik/](../../traefik/).
- [temp-sites.conf](/infra/nginx/conf.d/temp-sites.conf).
