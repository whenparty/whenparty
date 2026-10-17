# Traefik Router for Temp Sites

Traefik routes every `*.when.party` request to the right project container, based on Docker labels.

```
Internet → Cloudflare → nginx (TLS) → Traefik (HTTP :8000) → project containers
```

- nginx (`nginx/conf.d/temp-sites.conf`) terminates TLS and proxies to `traefik-tempsites:8000`.
- Traefik watches Docker and only routes containers on `wp_tempsites` that set `traefik.enable=true`.
- Port 8000 is not published. Only nginx reaches it over the Docker network.

## Deployment

`.github/workflows/traefik.yml` runs on pushes that change `temp-sites/traefik/**` (Markdown excluded), or manually from the Actions tab. It:

1. builds the dashboard credentials from the `TRAEFIK_DASHBOARD_USER` and `TRAEFIK_DASHBOARD_PASSWORD` secrets and writes them to `.env` on the VPS
2. copies `docker-compose.yml` and `traefik.yml` to `/opt/services/whenparty/tempsites/traefik`
3. pulls the image and recreates the container (so changes to `traefik.yml` take effect)
4. checks that the dashboard answers on the VPS loopback and asks for credentials (HTTP 401)

Recreating the container interrupts temp sites for a few seconds.

## Dashboard

The dashboard listens on Traefik's internal `traefik` entrypoint (`:8080`), published only on the VPS loopback as `127.0.0.1:18080`. It is not reachable from the internet. Open it through an SSH tunnel:

```bash
ssh -L 8080:127.0.0.1:18080 <user>@<vps>
```

Then browse to http://localhost:8080/dashboard/ and log in with the dashboard credentials.

To rotate the credentials, update the two secrets and run the workflow manually.

## Logs

Traefik logs to stdout:

```bash
docker logs -f traefik-tempsites
```

There is no Traefik access log, because nginx already logs every request.

## Connecting a Project

A project's `compose.yml` joins `wp_tempsites` and declares its route with labels (see [../README.md](../README.md#adding-a-project)):

```yaml
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.myapp.rule=Host(`myapp.when.party`)"
  - "traefik.http.routers.myapp.entrypoints=web"
  - "traefik.http.services.myapp.loadbalancer.server.port=80"
```

## Troubleshooting

```bash
# Is Traefik up and healthy?
docker ps --filter name=traefik-tempsites

# Did it discover the project's container?
docker logs traefik-tempsites | grep myapp
docker network inspect wp_tempsites

# Ask Traefik directly, bypassing nginx (404 means Traefik is up but no route matches)
docker run --rm --network wp_tempsites curlimages/curl -s -o /dev/null -w '%{http_code}\n' \
  -H 'Host: myapp.when.party' http://traefik-tempsites:8000/
```

A route only works if the container is on `wp_tempsites`, carries `traefik.enable=true`, is running, and its `Host` rule matches the request.

## Security Notes

- Traefik has read-only access to `/var/run/docker.sock`, which it needs for discovery. A [docker-socket-proxy](https://github.com/Tecnativa/docker-socket-proxy) would narrow that further.
- The dashboard needs both SSH access to the VPS and the basic auth credentials.
- `.env` holds the credentials hash. It is generated on every deploy and never committed.
