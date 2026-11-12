# Troubleshooting the proxy

Run these on the VPS in `/opt/services/whenparty/infra`:

```bash
docker exec nginx nginx -t
docker compose logs nginx
docker inspect -f '{{.State.Health.Status}}' nginx
```

The health check calls `/health` on port 80 inside the container, as [nginx-configs.md](nginx-configs.md#the-health-check) says.

| Symptom | Cause |
| --- | --- |
| A site answers 502 | Its container is down or not on the network it shares with nginx, as [sites.md](sites.md) says. `docker network inspect wp_www` and `docker network inspect wp_tempsites` list the containers on each network. |
| Every site of one zone answers 400 | Authenticated Origin Pulls is off in that zone, as [setup.md](setup.md) says. A request straight to the server's address gets 400 or a refused handshake on port 443, while port 80 answers 301. |
| A page of `games/` on a host other than `games.when.party` loads, but its players cannot find each other | Its host is missing from `games.conf`, so its page gets the Content-Security-Policy of the temporary sites, as [games-conf.md](games-conf.md) says. |
| A host answers Cloudflare's error 525 | No config names it, so the default server refuses the handshake, as [nginx-configs.md](nginx-configs.md#the-default-server) says. |
| nginx logs Cloudflare's addresses instead of visitors' | `cloudflare_real_ip.conf` is missing or empty. [cloudflare-ip-list.md](cloudflare-ip-list.md) says where the job logs. |
| A removed site or config still has an effect | Its file is still on the VPS, as [deploys.md](/.github/docs/deploys.md#infrayml) says. |
| The container does not start after a restart | A config on disk fails `nginx -t`, as [deploys.md](/.github/docs/deploys.md#infrayml) says. |
