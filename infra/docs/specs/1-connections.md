# Connections

- `1-1` On port 443, the proxy completes a TLS handshake only when the client names, in SNI, a host that [3-sites.md](3-sites.md) lists. For any other host, or without SNI, it refuses the handshake and sends no certificate.
- `1-2` On port 443, a request whose connection presents no client certificate signed by Cloudflare's origin-pull certificate authority answers 400 and reaches no site.
- `1-3` On port 80, a request for any path other than `/health` answers 301 with `Location` set to the same host, path and query on `https://`.
- `1-4` On port 80, `GET /health` answers 200 with the body `OK`, for any host.
- `1-5` A request from an address in Cloudflare's published IP ranges comes from the address in its `CF-Connecting-IP` header. Any other request comes from the address it was sent from. The limits of [2-headers.md](2-headers.md) count requests, and requests in progress, per such client address.
