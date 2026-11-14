# Games routing

## Context

[game-hosts.md](/docs/decisions/game-hosts.md) puts every title on `games.when.party` under a path of its own, so that a new title needs no change outside `games/`. Each title is served at `/<name>/`, where `<name>` is its deployment name, and the index page at the root, as [hosting.md](/games/titles/docs/hosting.md) says. The signaling server has the host `signaling.when.party`. [games.conf](/infra/nginx/conf.d/games.conf) serves both hosts. The temporary sites have hosts of their own, `<name>.when.party`, behind the Traefik router of `temp-sites/`.

Traefik mounts the Docker socket, so whoever controls it controls Docker on the VPS, and every deploy of it interrupts the sites behind it for a few seconds, as [traefik.md](/temp-sites/docs/traefik.md) says. It follows Docker's events, so it routes a container once it runs and is healthy. Any container on the VPS with Traefik labels can claim any host and path, and no check compares the labels of the temporary sites with the hosts and paths of the games.

nginx looks up container names in Docker's DNS through the `resolver` of [default.conf](/infra/nginx/conf.d/default.conf), both for an `upstream` with `resolve` and for a name that it builds from the request, such as `games-` and the first segment of the path. A name that does not exist gives 502, as a stopped container does. nginx keeps an answer for the resolver's `valid` time, so after a deploy gives a container a new address, requests to it can fail until that time runs out. Docker's DNS answers for every network nginx is on, the network of the temporary sites included.

## Options

- The previous setup: `games.conf` passes both hosts to the Traefik router of `temp-sites/`, and labels in `games/` set the path of each title, strip it, and redirect the titles' former hosts. A path that names no title reaches the index page, which answers 404. A new title needs only its labels, and a title can have routes of its own. The games depend on a deployment of another project, every deploy of Traefik interrupts them, and a temporary site can take a path of `games.when.party` or the signaling host.
- A Traefik router of the games' own, on a network of its own. The games no longer depend on `temp-sites/` and keep their labels. One more container with the Docker socket, and one more deploy and config. Without constraints, it also routes every labelled container on the VPS.
- One Traefik router in `infra/` for the games and the temporary sites. One router to maintain. Each deploy of it interrupts all of them, and any container can still claim any host.
- nginx passes `/<name>/` on `games.when.party` to the container `games-<name>` on the network `wp_games`, and the root and the signaling host to the containers of the index page and the signaling server through an `upstream` each. No Traefik for the games, and a new title still needs no change outside `games/`. A path that names no title, like a stopped title, gives 502, which `games.conf` shows as the games' 404 page. A check in CI keeps other containers off the names that nginx reaches, as [game-names-check.md](/docs/decisions/game-names-check.md) decides. After a deploy, requests to a container can fail for the resolver's `valid` time. The titles' containers get new names, and no title has routes of its own.
- nginx with a `location` and an `upstream` for each title in `games.conf`. A path that names no title still reaches the index page, and a stopped title answers 502. Every new title changes `infra/`, against game-hosts.md, and needs a check that keeps the list in step with `games/`. After a deploy, requests to a container can fail for the resolver's `valid` time here too.

## Decision

nginx routes the games by the first segment of the path. Against the previous setup and one router in `infra/`, a deploy of Traefik no longer interrupts the games, and the labels of a temporary site no longer reach the games' hosts, because nginx no longer passes them to Traefik. The check of game-names-check.md keeps other containers off the names that nginx looks up instead. Against a Traefik router of the games' own, it adds no container with the Docker socket. Against a `location` for each title, it keeps a new title within `games/`. A short `valid` time keeps the failures after a deploy to seconds. The titles lose routes of their own, and the only ones were the redirects of the former hosts, which [former-game-hosts.md](/docs/decisions/former-game-hosts.md) weighs on their own.

## Consequences

- [games.conf](/infra/nginx/conf.d/games.conf), [default.conf](/infra/nginx/conf.d/default.conf), [docker-compose.yml](/infra/docker-compose.yml) and [games-conf.md](/infra/docs/games-conf.md).
- [sites.md](/infra/docs/sites.md), and [deploys.md](/.github/docs/deploys.md) with the workflows it describes: [infra.yml](/.github/workflows/infra.yml), [deploy-project.yml](/.github/workflows/deploy-project.yml), [games.yml](/.github/workflows/games.yml) and [temp-sites.yml](/.github/workflows/temp-sites.yml).
- [hosting.md](/games/titles/docs/hosting.md), the compose files of the [titles](/games/titles/), and those of the [index page](/games/index/compose.yml) and the [signaling server](/games/platform/signaling/compose.yml).
- [traefik.md](/temp-sites/docs/traefik.md).
