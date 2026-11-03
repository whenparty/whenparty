# Site names and hosts

## Names

The name of a site's folder in `projects/` is its name in several places at once:

- the GHCR image `ghcr.io/whenparty/<name>`;
- the folder `/opt/services/whenparty/temp-sites/projects/<name>` on the VPS;
- by convention, the Compose project `tempsite-<name>`, the Traefik router and service `<name>` and the host `<name>.when.party`.

The image name, and the names the convention gives, must differ from those of the other deployments on the VPS:

- A site must not take the name of a deployment in `games/`, which is the last folder of each `games/*/compose.yml` and `games/*/*/compose.yml`. [check-project-names.yml](/.github/workflows/check-project-names.yml) checks this in `ci.yml` on pull requests and pushes to `main`. The temp-sites deploy does not wait for that check, as [ci-checks.md](/docs/decisions/ci-checks.md) explains, so a direct push to `main` with a clash deploys it anyway, and when the site has a `Dockerfile`, its image overwrites the deployment's `latest` tag. After that, every deploy of `games/` fails at the same check until the site is renamed.
- No check covers the other names. A site named `www` or `nii-au` would push over the images of those sites. A container name, if `compose.yml` sets one, must differ from every other container on the VPS, such as `nginx`, `traefik-tempsites` and the containers of the other sites and games. Two Compose projects with the same name replace or remove each other's containers, because the deploy runs with `--remove-orphans`.
- The routers `dashboard` and `unknown-host` and the middleware `dashboard-auth` belong to Traefik itself. The routers and middlewares of `games/` are named after their deployment, such as `tictactoe-path` and `tictactoe-old-host`, and belong to the games.

Renaming a site's folder removes the old site and adds a new one, as [deploy.md](deploy.md#removing-a-site) describes.

## Hosts

- A host is one level below `when.party`, because Cloudflare's free edge certificate and the origin certificate cover only `when.party` and the hosts one level below it, as [setup.md](/infra/docs/setup.md#certificates) and [game-hosts.md](/docs/decisions/game-hosts.md) say.
- `when.party` and `www.when.party` go to the When Party site, not to Traefik. The hosts of the games' deployments, such as `games.when.party`, `signaling.when.party`, `turn.when.party` and the other hosts that [games.conf](/infra/nginx/conf.d/games.conf) names, belong to the games.
- The host needs a proxied DNS record in Cloudflare that points to the VPS. Nothing in the repository creates it. Ask the user whether a wildcard record covers the host, and if not, to add the record.
