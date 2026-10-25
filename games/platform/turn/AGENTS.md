# TURN

coturn at `turn.when.party` relays WebRTC traffic when direct connections fail. [compose.yml](compose.yml) defines the container; [turnserver.conf](turnserver.conf) defines network restrictions and quotas. [start.sh](start.sh) adds the shared secret and detects the public address behind NAT.

## Deployment constraints

- Set the repository secret `TURN_SECRET` for both TURN and [signaling](../signaling/AGENTS.md). The [deploy workflow](../../../.github/workflows/deploy-project.yml) writes it to the private `.env` of both [deployments](/docs/glossary.md#deployment). TURN exits without it; signaling then issues no credentials.
- DNS for `turn.when.party` must point directly to the VPS without Cloudflare proxying. Open `3478/udp`, `3478/tcp` and `49152-49407/udp` in both firewalls. The service uses the host network and has no TLS endpoint.
- Keep the secret out of Git, logs and process arguments. The generated config belongs in private `/tmp` storage. Retain the container restrictions in Compose, including `NET_BIND_SERVICE`, which the image's binary requires.
- Deny private and special-use peer addresses. Keep the server's own public address allowed so two relayed clients can connect. No other UDP service may listen on that public address; inspect listeners with `sudo ss -ulpn` when provisioning.
- Do not add denied IPv6 ranges starting at `::`; coturn also matches IPv4 peers against them. Keep UDP relay allocations only and retain the resource quotas.

## Verification

Run `sh games/platform/turn/tests/smoke.sh` from the repository root when changing TURN configuration, startup or image. It needs Docker and checks the deployed configuration with coturn's client. [The test](tests/smoke.sh) covers public and private peers, two relayed clients, credentials and secret exposure; [games CI](../../../.github/workflows/games.yml) runs it before deployment.
