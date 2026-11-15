import {createHmac, randomBytes} from 'node:crypto'

export const turnCredentials = ({secret, urls, ttlSeconds}, now = Date.now()) => {
  const username = `${Math.floor(now / 1000) + ttlSeconds}:${randomBytes(8).toString('hex')}`
  const credential = createHmac('sha1', secret).update(username).digest('base64')

  return {urls, username, credential, ttlSeconds}
}

export const turnFromEnv = env => {
  if (!env.TURN_SECRET) {
    return null
  }

  return {
    secret: env.TURN_SECRET,
    urls: (env.TURN_URLS ?? '')
      .split(',')
      .map(url => url.trim())
      .filter(Boolean),
    ttlSeconds: Number(env.TURN_TTL_SECONDS ?? 86_400)
  }
}
