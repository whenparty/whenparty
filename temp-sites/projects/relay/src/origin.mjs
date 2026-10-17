// Pages that may use the relay: the games on when.party and its subdomains, plus localhost
// for local development. Non-browser clients can fake Origin, so this only stops other
// websites from using the relay through their visitors' browsers.
const gameHost = /^([a-z0-9-]+\.)*when\.party$/
const localHosts = new Set(['localhost', '127.0.0.1'])

export const isAllowedOrigin = origin => {
  if (!origin || !URL.canParse(origin)) {
    return false
  }

  const {protocol, hostname} = new URL(origin)

  if (protocol === 'https:') {
    return gameHost.test(hostname)
  }

  return protocol === 'http:' && localHosts.has(hostname)
}
