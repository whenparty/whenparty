// The production headers from infra/nginx/conf.d (temp-sites.conf and default.conf), plus the
// local signaling server. Titles send them from the Vite dev and preview servers, so local
// development breaks the same way production would, for example on a script from a CDN or
// on Trystero's default public Nostr servers. Keep them in sync with nginx.
export const devHeaders: Record<string, string> = {
  'Content-Security-Policy':
    "default-src 'self'; img-src 'self' data:; script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline'; connect-src 'self' wss://signaling.when.party ws://localhost:8080; frame-ancestors 'none';",
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()'
}
