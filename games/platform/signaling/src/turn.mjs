// Short-lived credentials for the TURN server (games/platform/turn), in coturn's TURN REST API
// format: the username is the expiry time and a random ID, and the password is its HMAC-SHA1
// under the secret that coturn shares. The secret never leaves the servers, and a password that
// leaks stops working at the expiry time.
import {createHmac, randomBytes} from 'node:crypto'

export const turnCredentials = ({secret, urls, ttlSeconds}, now = Date.now()) => {
  const username = `${Math.floor(now / 1000) + ttlSeconds}:${randomBytes(8).toString('hex')}`
  const credential = createHmac('sha1', secret).update(username).digest('base64')

  return {urls, username, credential, ttlSeconds}
}

// The TURN settings from the environment, or null without TURN_SECRET
export const turnFromEnv = env => {
  if (!env.TURN_SECRET) {
    return null
  }

  return {
    secret: env.TURN_SECRET,
    urls: (env.TURN_URLS ?? '').split(',').map(url => url.trim()).filter(Boolean),
    // Longer than a game: coturn checks the expiry again whenever the browser refreshes its
    // allocation, every few minutes, so a session outlives its credentials only by that much
    ttlSeconds: Number(env.TURN_TTL_SECONDS ?? 86_400)
  }
}
