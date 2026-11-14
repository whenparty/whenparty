# Temp sites

`temp-sites/` is the [project](/docs/glossary.md#project) of the temporary sites on `*.when.party` and of the Traefik router that serves them. Each folder in `projects/` is a [subproject](/docs/glossary.md#subproject) that holds one site and is one [deployment](/docs/glossary.md#deployment). `traefik/` is one more deployment and not a subproject.

- [docs/sites.md](docs/sites.md): how to add a site to `projects/` and what its `compose.yml` must hold, what the proxy lets a page load, secrets on the VPS, and how to run a site locally. Read it before adding or changing a site.
- [docs/names.md](docs/names.md): the names a site must not share with other deployments on the VPS, and which hosts it can use. Read it before naming or renaming a site.
- [docs/deploy.md](docs/deploy.md): what a push deploys from `projects/`, what stays on the VPS, when the first deploy of a site with a `Dockerfile` fails, how to retry a failed deploy, and how to remove or rename a site. Read it before adding, deploying, retrying, renaming or removing a site.
- [docs/traefik.md](docs/traefik.md): the router in `traefik/`: what other code relies on, its deploy, the dashboard and its credentials, troubleshooting and security. Read it before changing `traefik/` or when a host does not reach its container.
- [/infra/docs/sites.md](/infra/docs/sites.md): how the nginx proxy reaches the Traefik router by its container name and the `wp_tempsites` network, what must change on both sides when either changes, and what a 502 means.
- [docs/decisions/routing.md](docs/decisions/routing.md): why Traefik, not nginx, routes the temporary sites, and why each keeps a host of its own.
