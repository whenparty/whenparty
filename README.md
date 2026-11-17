# WhenParty

Everything that runs on the WhenParty VPS: the When Party site at `www.when.party` and its blog at `blog.when.party`, the site at `www.nii.au`, temporary sites and peer-to-peer browser games on `*.when.party`, and the nginx proxy in front of them all.

## How a request reaches a site

Every site sits behind Cloudflare. Cloudflare passes each request to the nginx proxy in [infra/](/infra/README.md), which terminates TLS (`1-1` of the proxy's [1-connections.md](/infra/docs/specs/1-connections.md)), adds the [security headers](/infra/docs/specs/2-headers.md) and hands the request to the right container, as [3-sites.md](/infra/docs/specs/3-sites.md) says. `when.party` and `nii.au` redirect to their `www` hosts. On `games.when.party`, the proxy finds a game title's container by its path, with the page that lists the games at its root, and it passes `signaling.when.party` to the signaling server, as [4-games.md](/infra/docs/specs/4-games.md) says. `blog.when.party` goes to the blog's container. Every other `*.when.party` host goes to the Traefik router of [temp-sites/](/temp-sites/README.md), which finds the temporary site's container by its host name.

```mermaid
flowchart LR
  visitor[Visitor] --> cloudflare[Cloudflare]
  cloudflare --> nginx["nginx proxy: TLS, headers"]
  nginx -->|www.when.party| www[www container]
  nginx -->|blog.when.party| blog[blog container]
  nginx -->|www.nii.au| niiau[nii-au container]
  nginx -->|"games and signaling hosts"| games["game and signaling containers"]
  nginx -->|"other *.when.party"| traefik[Traefik router]
  traefik --> temp[temp site containers]
  player[Player browser] -->|"direct, not through Cloudflare"| turn["TURN relay: turn.when.party"]
```

The games in [games/](/games/README.md) send game data directly between players' browsers. The signaling server at `signaling.when.party` helps the players find each other. When two browsers cannot connect directly, they relay through the TURN server, which players reach [without Cloudflare or nginx](/games/platform/turn/docs/deployment.md).

## How changes reach the VPS

A change reaches `main` through a [pull request](/.github/docs/github-setup.md#main-branch) once `ci.yml` passes on it. A push to `main` [deploys](/.github/docs/deploys.md) only the parts whose files it changes. A change to Markdown files alone deploys nothing, apart from a post of the blog.

| Folder | Workflow | What it deploys |
| --- | --- | --- |
| `infra/` | `infra.yml` | the nginx proxy and its configs |
| `www/` | `www.yml` | the When Party site |
| `blog/` | `blog.yml` | the blog |
| `nii-au/` | `nii-au.yml` | the `www.nii.au` site |
| `temp-sites/projects/` | `temp-sites.yml` | each temporary site that changed |
| `temp-sites/traefik/` | `traefik.yml` | the Traefik router |
| `games/` | `games.yml` | the [deployments](/docs/glossary.md#deployment) that a change reaches: each game, the index page, the signaling server and the TURN relay |

The [workflows](/.github/workflows/) live in `.github/workflows/`. Each site and game runs as a container from an image that the workflow builds and pushes to the [GitHub Container Registry](/.github/docs/github-setup.md#container-packages), and the VPS pulls it from there.

Before a deploy, `games.yml` runs the games' tests and `infra.yml` checks the nginx configs, as [checks.md](/.github/docs/checks.md) says. Every pull request and every push to `main` also runs these checks for what it changes. It also checks that deployment names do not clash and that no other container takes a name the proxy uses for the games, runs the browser tests of the When Party site and builds the blog. Once a week, every image the VPS runs is [scanned](/.github/docs/image-scan.md) for known vulnerabilities.
