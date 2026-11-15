import {createHmac, randomBytes} from 'node:crypto'
import type {TurnServers} from '../protocol.ts'

export const turnUrls: readonly string[] = ['turn:turn.when.party:3478?transport=udp', 'turn:turn.when.party:3478?transport=tcp']

const lifetimeSeconds = 86_400

export const turnCredentials = (secret: string, now: number): TurnServers => {
  const username = `${Math.floor(now / 1000) + lifetimeSeconds}:${randomBytes(8).toString('hex')}`
  return {urls: turnUrls, username, credential: createHmac('sha1', secret).update(username).digest('base64')}
}
