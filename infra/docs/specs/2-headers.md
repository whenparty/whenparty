# Headers and limits

- `2-1` Every response on port 443 carries these headers:

  | Header | Value |
  | --- | --- |
  | `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` |
  | `X-Frame-Options` | `SAMEORIGIN` |
  | `X-Content-Type-Options` | `nosniff` |
  | `Referrer-Policy` | `strict-origin-when-cross-origin` |
  | `X-Permitted-Cross-Domain-Policies` | `none` |
  | `Permissions-Policy` | `geolocation=(), microphone=(), camera=()` |
  | `Cross-Origin-Embedder-Policy` | `credentialless` |
  | `Cross-Origin-Opener-Policy` | `same-origin` |
  | `Cross-Origin-Resource-Policy` | `same-origin` |

- `2-2` Every response of a site also carries the site's `Content-Security-Policy`. The redirects of `when.party` and `nii.au`, and `signaling.when.party`, carry none.

  | Host | `Content-Security-Policy` |
  | --- | --- |
  | `www.when.party` | `default-src 'self'; script-src 'self' https://static.cloudflareinsights.com; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self' https://static.cloudflareinsights.com; frame-ancestors 'self';` |
  | `www.nii.au` | `default-src 'self'; script-src 'self' https://static.cloudflareinsights.com; style-src 'self'; img-src 'self'; media-src 'self' blob:; connect-src 'self' https://static.cloudflareinsights.com; frame-ancestors 'self';` |
  | `games.when.party` | `default-src 'self'; img-src 'self' data:; script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline'; connect-src 'self' wss://signaling.when.party https://signaling.when.party; frame-ancestors 'none';` |
  | a temporary site | `default-src 'self'; img-src 'self' data:; script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline'; frame-ancestors 'none';` |

- `2-3` A request reaches its site with its own `Host`, the client address of [1-connections.md](1-connections.md) in `X-Real-IP` and appended to `X-Forwarded-For`, and `X-Forwarded-Proto: https`. A WebSocket upgrade reaches the site with its `Upgrade` header and `Connection: upgrade`.
- `2-4` Each client address may send requests and keep requests in progress as this table says. `signaling.when.party` counts them on its own, and all other hosts count them together. A request beyond either limit answers 503. An open WebSocket counts as a request in progress until it closes.

  | Hosts | Requests at once | Then one more every | Requests in progress |
  | --- | --- | --- | --- |
  | `signaling.when.party` | 101 | 100 ms | 64 |
  | all other hosts | 31 | 100 ms | 15 |

- `2-5` On every host, a request stays open while its site sends something at least every 90 seconds, and an open WebSocket while its site or its client does. After 90 seconds of such silence, the proxy closes it, and answers 504 if the site has sent no response yet, which on `games.when.party` shows the games' 404 page of [4-games.md](4-games.md).
- `2-6` A request whose body is larger than 1 MiB (1,048,576 bytes) answers 413 and does not reach its site.
- `2-7` On every host, when the container that a request goes to, which for a temporary site is the router of the temporary sites, does not accept the proxy's connection within 2 seconds, the request answers 504, which on `games.when.party` shows the games' 404 page of [4-games.md](4-games.md).
