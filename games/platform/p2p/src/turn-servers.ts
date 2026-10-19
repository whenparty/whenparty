// The TURN servers a page relays through when it can't reach a peer directly: phones behind their
// carrier's NAT, strict office networks. Their short-lived credentials come from the signaling
// server (games/platform/signaling, /turn-credentials). Without them the page connects as before,
// directly or not at all.

// What Trystero's turnConfig takes
export interface TurnServer {
  urls: string[]
  username: string
  credential: string
}

interface Credentials extends TurnServer {
  ttlSeconds: number
}

const isCredentials = (value: unknown): value is Credentials => {
  const body = value as Partial<Credentials> | null

  return (
    typeof body === 'object' &&
    body !== null &&
    Array.isArray(body.urls) &&
    body.urls.every(url => typeof url === 'string' && /^turns?:/.test(url)) &&
    typeof body.username === 'string' &&
    typeof body.credential === 'string' &&
    Number.isFinite(body.ttlSeconds) &&
    Number(body.ttlSeconds) > 0
  )
}

export interface TurnServerLoaderOptions {
  fetch?: typeof globalThis.fetch
  now?: () => number
  // A page waits this long at most before it joins without TURN
  timeoutMs?: number
  // After a failure (TURN off, or the server down), how long until the page asks again
  retryMs?: number
}

// Loads the TURN servers for each join, but asks the signaling server again only after half the
// credentials' lifetime. Joins at the same time share one request. On any failure it gives no
// servers rather than an error.
export const turnServerLoader = (
  url: string,
  {fetch = globalThis.fetch, now = Date.now, timeoutMs = 3000, retryMs = 60_000}: TurnServerLoaderOptions = {}
): (() => Promise<TurnServer[]>) => {
  let known: {servers: TurnServer[]; until: number} | null = null
  let loading: Promise<TurnServer[]> | null = null

  const load = async (): Promise<TurnServer[]> => {
    try {
      const response = await fetch(url, {signal: AbortSignal.timeout(timeoutMs), cache: 'no-store'})
      const body: unknown = response.ok ? await response.json() : null

      if (!isCredentials(body)) {
        known = {servers: [], until: now() + retryMs}
        return []
      }

      const {urls, username, credential, ttlSeconds} = body
      const servers = urls.length > 0 ? [{urls, username, credential}] : []
      known = {servers, until: now() + ttlSeconds * 500}
      return servers
    } catch {
      known = {servers: [], until: now() + retryMs}
      return []
    } finally {
      loading = null
    }
  }

  return () => {
    if (known && now() < known.until) {
      return Promise.resolve(known.servers)
    }

    loading ??= load()
    return loading
  }
}
