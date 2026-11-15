const localHosts = new Set(['localhost', '127.0.0.1'])

export const isAllowedOrigin = (origin: unknown): boolean => {
  if (typeof origin !== 'string' || !URL.canParse(origin)) {
    return false
  }
  const url = new URL(origin)
  if (url.origin !== origin) {
    return false
  }
  const {protocol, hostname} = url
  if (protocol === 'https:') {
    return hostname === 'when.party' || hostname.endsWith('.when.party')
  }
  return protocol === 'http:' && localHosts.has(hostname)
}
