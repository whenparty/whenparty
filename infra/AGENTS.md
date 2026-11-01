# infra

`infra/` is the [project](/docs/glossary.md#project) of the nginx proxy that terminates TLS for every site on the WhenParty VPS and passes each request to the site's container. It is one [deployment](/docs/glossary.md#deployment), which [infra.yml](/.github/workflows/infra.yml) deploys.

- [nginx-configs.md](docs/nginx-configs.md): how the files in `nginx/conf.d/` combine the shared settings with a site's own, and how to check a change with `nginx -t`. Read it before changing `nginx/conf.d/` or the nginx image in `docker-compose.yml`.
- [sites.md](docs/sites.md): how the proxy reaches the container of each site, and how to add or remove a site. Read it before changing an upstream, the networks in `docker-compose.yml`, or the name of a container or network of a site.
- [The infra.yml section of deploys.md](/.github/docs/deploys.md#infrayml): what `infra.yml` does on the VPS and what the deploy leaves behind. Read it before changing `infra.yml` or removing a file from `infra/`.
- [cloudflare-ip-list.md](docs/cloudflare-ip-list.md): the list of Cloudflare addresses that nginx trusts for the client's address, and the hourly job that refreshes it. Read it before changing `scripts/` or the real IP settings in `default.conf`.
- [setup.md](docs/setup.md): what the proxy needs on the VPS and in Cloudflare: folders, certificates and zone settings. Read it before setting up a VPS or a new domain, or replacing a certificate.
- [troubleshooting.md](docs/troubleshooting.md): what to check on the VPS when a site fails.
