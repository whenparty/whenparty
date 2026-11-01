# The Traefik router

`traefik/` runs the Traefik container `traefik-tempsites`, which routes each `*.when.party` request to a container by its Docker labels. It serves the temp sites and the deployments of [`games/`](/games/AGENTS.md). `traefik/docker-compose.yml` runs the container, and `traefik/traefik.yml` is Traefik's static configuration. [sites.md](sites.md#composeyml) says which labels a site sets.

## What other code relies on

- The nginx proxy reaches the router as `traefik-tempsites:8000` on the `wp_tempsites` network, as [temp-sites.conf](/infra/nginx/conf.d/temp-sites.conf) sets. A change to the container name or the `web` entrypoint's port needs the same change there, as [sites.md](/infra/docs/sites.md) says. The network name also appears in [infra/docker-compose.yml](/infra/docker-compose.yml), in the deploy workflows that create the network, and in the `compose.yml` of every site and game.
- The `web` entrypoint on port 8000 is not published on the host, so every request reaches Traefik through nginx, with its certificate check, headers and limits. Publishing it would let requests skip them.
- Traefik routes only containers that set `traefik.enable=true`, and reaches them only over `wp_tempsites`. Every site and game relies on the `web` entrypoint by that name.
- Traefik trusts `X-Forwarded-*` headers from addresses in `172.16.0.0/12`, so the containers see the client address that nginx passes on.
- The `traefik` entrypoint on port 8080 serves the dashboard, the API and the ping that the healthcheck uses. It is published only on the VPS loopback as `127.0.0.1:18080`. The deploy checks the dashboard on that address.

## Deploy

- The workflow [traefik.yml](/.github/workflows/traefik.yml) runs on a push to `main` that changes it or a file in `traefik/` other than Markdown, or by hand from GitHub Actions, as [deploys.md](/.github/docs/deploys.md) describes.
- It copies only `traefik/docker-compose.yml` and `traefik/traefik.yml` to `/opt/services/whenparty/temp-sites/traefik`. A new file that the router needs also needs a change to that copy step.
- It writes `.env` with the dashboard credentials from the repository secrets `TRAEFIK_DASHBOARD_USER` and `TRAEFIK_DASHBOARD_PASSWORD`, pulls the image and recreates the container. So every deploy applies the static configuration, and every deploy interrupts the temp sites and games for a few seconds.
- No check runs before the deploy. It fails when the dashboard does not answer with HTTP 401 within about 30 seconds, and then the router may be down for every site and game. Revert the change on `main`, which deploys the previous files.
- [image-scan.md](/.github/docs/image-scan.md) says how the Traefik image is scanned.

## Dashboard

From outside the VPS, the dashboard needs an SSH tunnel and the dashboard credentials. Every container on `wp_tempsites` reaches `traefik-tempsites:8080` directly, so there only the credentials guard it. To open the tunnel:

```bash
ssh -L 8080:127.0.0.1:18080 <user>@<vps>
```

Then open http://localhost:8080/dashboard/ and log in. To change the credentials, update the two secrets and run the workflow by hand from `main`.

## Troubleshooting

Traefik answers 404 when no router matches the host: the container is not running or not healthy, does not set `traefik.enable=true`, or has a `Host` rule that does not match. A labelled container that is not on `wp_tempsites` gets a router, but Traefik cannot reach it and answers with a gateway error, such as 502 or 504. On the VPS:

```bash
# Is Traefik up and healthy?
docker ps --filter name=traefik-tempsites

# Is the container on the network? Did Traefik log errors about its labels?
docker network inspect wp_tempsites
docker logs traefik-tempsites | grep <name>

# Which routers did Traefik find? Asks for the dashboard password.
curl -u <user> http://127.0.0.1:18080/api/http/routers

# Ask Traefik directly, past nginx. 404 means no router matches the host.
docker run --rm --network wp_tempsites curlimages/curl -s -o /dev/null -w '%{http_code}\n' \
  -H 'Host: <name>.when.party' http://traefik-tempsites:8000/
```

Traefik keeps no access log. Requests are only in the nginx log, which [troubleshooting.md](/infra/docs/troubleshooting.md) shows how to read.

## Security

- Traefik mounts `/var/run/docker.sock` to find containers. The `:ro` flag only keeps the socket file from being replaced; it does not limit the Docker API. Whoever controls Traefik controls Docker on the VPS.
- `.env` holds the hash of the dashboard password. Every deploy writes it with mode 600, and git ignores it.
