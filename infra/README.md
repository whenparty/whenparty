# nginx proxy

The nginx proxy that stands in front of every site on the WhenParty VPS. It is the only container that listens on the public ports 80 and 443.

On port 443 it terminates TLS with [Cloudflare Origin Certificates](docs/setup.md#certificates) for `when.party` and `nii.au`. It answers a request only when its connection presents Cloudflare's client certificate, as the [specification](docs/specs/1-connections.md) says. This is Cloudflare's [Authenticated Origin Pulls](docs/setup.md#cloudflare), so a request sent straight to the server's address, around Cloudflare, gets an error. A connection for a host that no site uses, or without a host name, is refused before any certificate is sent. Port 80 redirects every request to HTTPS and answers a health check.

```mermaid
flowchart LR
  cloudflare["Cloudflare, with its client certificate"] -->|443| nginx[nginx proxy]
  direct[Direct request to the server] -->|443| reject["400 error or refused handshake"]
  nginx -->|wp_www network| sites["www, blog and nii-au containers"]
  nginx -->|wp_games network| games["game and signaling containers"]
  nginx -->|wp_tempsites network| traefik["Traefik: temp sites"]
```

For every site the proxy sets the same [security headers](docs/specs/2-headers.md), rate limits each client address and passes WebSocket connections through. Each site adds its own Content-Security-Policy. Cloudflare sends the visitor's address in a header, and the proxy trusts that header only from Cloudflare's addresses. A [job on the VPS](docs/cloudflare-ip-list.md) refreshes the list of those addresses every hour.

A change to the configs [goes live](/.github/docs/deploys.md) when it reaches `main`, after the configs pass `nginx -t` and [tests](docs/verification.md) that run the proxy in Docker against stand-ins for the sites.
