# Site names and hosts

## Names

The name of a site's folder in `projects/` is its name in several places at once:

- the GHCR image `ghcr.io/whenparty/<name>`, as [github-setup.md](/.github/docs/github-setup.md#container-packages) says;
- the folder `/opt/services/whenparty/temp-sites/projects/<name>` on the VPS, as [deploys.md](/.github/docs/deploys.md#deploy-projectyml) says;
- by convention, the Compose project `tempsite-<name>`, the Traefik router and service `<name>` and the host `<name>.when.party`.

The image name, and the names the convention gives, must differ from those of the other [deployments](/docs/glossary.md#deployment) on the VPS:

- A site must not take the name of a deployment in `games/`, which is the last folder of each `games/*/compose.yml` and `games/*/*/compose.yml`, as [deploys.md](/.github/docs/deploys.md#deploy-projectyml) says. [check-project-names.yml](/.github/workflows/check-project-names.yml) checks this in `ci.yml` on pull requests, in the merge queue and on pushes to `main`, as [checks.md](/.github/docs/checks.md) says, and a pull request with a clash cannot merge, as [github-setup.md](/.github/docs/github-setup.md#main-branch) says. The temp-sites deploy does not wait for that check, as [ci-checks.md](/docs/decisions/ci-checks.md) explains, so a clash that reaches `main` past the queue, such as through a direct push of a new site with the name of a game, deploys anyway, and when the site has a `Dockerfile`, its image overwrites the deployment's `latest` tag. After that, every deploy of `games/` fails at the same check until the site is renamed.
- No container, Compose service or network alias of a site may have a name that starts with `games-` or that [games.conf](/infra/nginx/conf.d/games.conf) names, such as `index` or `signaling`, because nginx looks these names up for the games on every network it is on, as the proxy's [sites.md](/infra/docs/sites.md) says. [check-game-names.yml](/.github/workflows/check-game-names.yml) checks this in `ci.yml`, as [checks.md](/.github/docs/checks.md#the-checks) says, and no deploy waits for it, as [game-names-check.md](/docs/decisions/game-names-check.md) decides.
- No check covers the other names. A site named `www`, `blog` or `nii-au` would push over the images of those sites, as [github-setup.md](/.github/docs/github-setup.md#container-packages) says, and a container, Compose service or network alias with one of these names would take requests of those sites, because nginx looks them up on every network it is on, as the proxy's [sites.md](/infra/docs/sites.md) says. A container name, if `compose.yml` sets one, must differ from every other container on the VPS, such as `nginx`, `traefik-tempsites` and the containers of the other sites and games. Two Compose projects with the same name replace or remove each other's containers, because the deploy runs with `--remove-orphans`, as [deploys.md](/.github/docs/deploys.md#deploy-projectyml) says.
- The routers `dashboard` and `unknown-host` and the middleware `dashboard-auth` belong to Traefik itself, which sets them in [traefik/docker-compose.yml](../traefik/docker-compose.yml).

Renaming a site's folder removes the old site and adds a new one, as [deploy.md](deploy.md#removing-a-site) describes.

## Hosts

- A host is one level below `when.party`, because Cloudflare's free edge certificate and the origin certificate cover only `when.party` and the hosts one level below it, as [setup.md](/infra/docs/setup.md#certificates) and [game-hosts.md](/docs/decisions/game-hosts.md) say.
- `when.party` and `www.when.party` go to the When Party site and `blog.when.party` to the blog, not to Traefik, as `3-1` of the proxy's [3-sites.md](/infra/docs/specs/3-sites.md) says. The hosts of the games' deployments, `games.when.party`, `signaling.when.party` and [`turn.when.party`](/games/platform/turn/docs/deployment.md), belong to the games. The former hosts of the games' titles, `tictactoe.when.party` and `calisthenics.when.party`, answer with the page for unknown hosts, as [former-game-hosts.md](/docs/decisions/former-game-hosts.md) decides.
- The wildcard DNS record of [setup.md](/infra/docs/setup.md#cloudflare) covers the host.
