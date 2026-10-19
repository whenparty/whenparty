# TURN Server

[coturn](https://github.com/coturn/coturn) on the VPS, at `turn.when.party`, for the peer-to-peer games on `*.when.party`. When two browsers can't connect directly, they relay their WebRTC connection through it. That is common when one of them is a phone on mobile data, behind its carrier's NAT, or on a strict office or hotel network.

```
browser ──UDP 3478──▶ coturn on the VPS ◀──UDP 3478── browser
            (relays only for clients with valid credentials)

browser ──HTTPS through Cloudflare──▶ signaling.when.party/turn-credentials   (short-lived credentials)
```

Browsers that can connect directly still do: WebRTC tries the direct paths first and uses the relay only when none works. The game data stays encrypted end to end (DTLS) and coturn sees only encrypted packets.

## Before the First Deploy

TURN can't go through Cloudflare's proxy, which carries only HTTP and WebSockets. The browsers reach it on the VPS directly.

1. **Secret.** Add a random `TURN_SECRET` repository secret, for example with `openssl rand -hex 32 | gh secret set TURN_SECRET --repo whenparty/whenparty`. The deploy writes it to the project's `.env` on the VPS (readable by the deploy user only), for this project and the signaling server. Without it this container exits with a message, the signaling server hands out no credentials, and the games connect as before.
2. **DNS.** Add an `A` record `turn.when.party` pointing to the VPS, **DNS only** (grey cloud, not proxied). That makes the VPS address public. The web stays behind Cloudflare, because port 443 accepts only Cloudflare's client certificate (`infra/nginx/conf.d/default.conf`). If the provider offers a second IP address, using it for TURN keeps the main one hidden.
3. **Firewall.** Open `3478/udp`, `3478/tcp` and `49152-49407/udp` (the relay ports, one per allocation) in the VPS firewall and in the provider's.
4. **No other UDP services on the public address.** The relay may send UDP to the VPS's own public address, which relaying between two relayed browsers needs (see below). Check that nothing else listens on UDP there: `sudo ss -ulpn` should show only `turnserver` (and loopback-only services such as `127.0.0.53` for DNS).

## How It Is Kept Safe

- **Short-lived credentials only** (TURN REST API, `use-auth-secret`). The signaling server signs a username of the form `expiry:random-id` with the shared secret (`games/platform/signaling/src/turn.mjs`), only for pages on `*.when.party`. The secret never reaches a browser, and a password stops working at its expiry, 24 hours after it was handed out.
- **The secret stays out of sight.** `start.sh` writes it into the config in `/tmp` (a tmpfs, readable by coturn's user only), never into the process arguments.
- **No relaying into the server's networks.** `turnserver.conf` denies private, local and special-use ranges: the Docker networks where signaling and Traefik run, `10/8`, `192.168/16`, link-local (cloud metadata at `169.254.169.254`), CGNAT and IPv6 private ranges. Loopback is denied by default.
- **UDP relays only** (`no-tcp-relay`): browsers relay over UDP, and nothing can reach a TCP service through this server, such as SSH, nginx or Traefik.
- **Small quotas.** 64 KB/s per session (`max-bps`, far more than game messages need, too little to relay video), 32 allocations per user and 256 in total, which is also the size of the relay port range.
- **Hardened container.** It runs as `nobody`, with a read-only file system, all capabilities dropped but `NET_BIND_SERVICE` (the image's `turnserver` binary carries it as a file capability, and won't start without it), and `no-new-privileges`. The CLI and the web admin are off, as they are by default.

Two things in `turnserver.conf` look like hardening but break TURN, and `tests/smoke.sh` checks for both:

- **The server's own address must stay allowed.** When both browsers relay, each one's peer is the other's relay address on this server. Denying it refuses every such connection with 403.
- **No IPv6 range may start at `::`**, as `::-::ffff` (meant for `::` and `::1`). coturn then matches every IPv4 peer against it and relays nothing.

## Network

The container uses the host's network (`network_mode: host`). Relaying needs a port per allocation, and publishing 256 ports through Docker is slow and hides the clients' real addresses. On a VPS behind its provider's NAT, where the public address is on no interface, `start.sh` finds it (`detect-external-ip`, which honors `REAL_EXTERNAL_IP`) and sets `external-ip`.

No TLS yet. It would let browsers relay over TCP 443 from networks that block everything else (some offices and hotels), but needs a second IP address (nginx has 443) or port 5349, and a Let's Encrypt certificate for `turn.when.party`.

## Testing

```bash
sh tests/smoke.sh
```

starts this coturn in Docker, with `turnserver.conf` and `start.sh` as deployed, on an internal network, and checks it with coturn's own test client. Good credentials relay to a public peer and between two relayed clients without loss. Private peers (including `127.0.0.1` and `169.254.169.254`) are refused with 403. Bad credentials get no allocation. The secret is not in the process arguments. `games.yml` runs it before every games deploy.

After deploying, from a phone on mobile data and a laptop on Wi-Fi, a room should connect where it showed "could not connect to the players in it" before. `docker logs turn` on the VPS shows the allocations.
