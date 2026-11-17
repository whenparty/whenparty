# Temp sites

Small sites that live for a while on their own host under `when.party`, such as `dtm-cleaning.when.party`. Each site is a folder in `projects/` with its own container, as [sites.md](docs/sites.md) describes. `dtm-cleaning` is a placeholder page.

Apart from the hosts with a site of their own, such as `www.when.party` and `games.when.party`, nginx hands every `*.when.party` host to one Traefik router, which `traefik/` holds, as `3-1` of the proxy's [3-sites.md](/infra/docs/specs/3-sites.md) says. Traefik reads the labels of the running containers and sends the request to the container whose label names that host, as [traefik.md](docs/traefik.md) describes.

```mermaid
flowchart LR
  visitor[Visitor] --> cloudflare[Cloudflare]
  cloudflare --> proxy["nginx proxy: TLS and headers"]
  proxy --> traefik["Traefik router"]
  traefik --> site["site container"]
```

A new or changed site [goes live when it reaches `main`](docs/deploy.md), once its image is public. Only the sites that a change touches are rebuilt. A site whose folder is deleted is taken down.
