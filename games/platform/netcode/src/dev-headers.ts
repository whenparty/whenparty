export const devHeaders: Record<string, string> = {
  'Content-Security-Policy':
    "default-src 'self'; img-src 'self' data:; script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline'; connect-src 'self' wss://signaling.when.party ws://localhost:8080; frame-ancestors 'none';",
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()'
}
