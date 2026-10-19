import assert from 'node:assert/strict'
import {describe, it} from 'node:test'
import {turnServerLoader} from '../turn-servers.ts'

const credentials = {
  urls: ['turn:turn.when.party:3478?transport=udp', 'turn:turn.when.party:3478?transport=tcp'],
  username: '1700000000:0123456789abcdef',
  credential: 'c2VjcmV0',
  ttlSeconds: 86_400
}

// A fetch that answers with the given responses in turn, and counts its calls
const fakeFetch = (...answers: Array<() => Promise<Response>>) => {
  let calls = 0
  const fetch = (async () => {
    const answer = answers[Math.min(calls, answers.length - 1)]
    calls++
    return answer!()
  }) as typeof globalThis.fetch

  return {fetch, calls: () => calls}
}

const json = (body: unknown, status = 200) => async () => new Response(JSON.stringify(body), {status})

describe('turnServerLoader', () => {
  it('gives the TURN servers with their credentials', async () => {
    const {fetch} = fakeFetch(json(credentials))
    const load = turnServerLoader('https://signaling.example/turn-credentials', {fetch})

    assert.deepEqual(await load(), [
      {urls: credentials.urls, username: credentials.username, credential: credentials.credential}
    ])
  })

  it('asks again only after half the credentials lifetime, and shares one request', async () => {
    let time = 0
    const {fetch, calls} = fakeFetch(json(credentials))
    const load = turnServerLoader('https://signaling.example/turn-credentials', {fetch, now: () => time})

    await Promise.all([load(), load()])
    time = 43_199_000
    await load()

    assert.equal(calls(), 1)

    time = 43_201_000
    await load()

    assert.equal(calls(), 2)
  })

  it('gives no servers when TURN is off, the server fails or the answer is malformed', async () => {
    for (const answer of [
      json(null, 404),
      async () => Promise.reject(new TypeError('network')),
      json({...credentials, urls: ['https://evil.example']}),
      json({...credentials, ttlSeconds: 0}),
      async () => new Response('not json')
    ]) {
      const load = turnServerLoader('https://signaling.example/turn-credentials', {fetch: fakeFetch(answer).fetch})

      assert.deepEqual(await load(), [])
    }
  })

  it('asks again a while after a failure', async () => {
    let time = 0
    const {fetch, calls} = fakeFetch(json(null, 404), json(credentials))
    const load = turnServerLoader('https://signaling.example/turn-credentials', {fetch, now: () => time, retryMs: 60_000})

    assert.deepEqual(await load(), [])
    time = 59_000
    assert.deepEqual(await load(), [])
    time = 61_000

    assert.equal((await load()).length, 1)
    assert.equal(calls(), 2)
  })

  it('gives up after timeoutMs, so a slow server delays a join only that long', async () => {
    const fetch = ((_url: string, init?: RequestInit) =>
      new Promise((_, reject) => init?.signal?.addEventListener('abort', () => reject(init.signal?.reason)))) as typeof globalThis.fetch
    const load = turnServerLoader('https://signaling.example/turn-credentials', {fetch, timeoutMs: 20})

    assert.deepEqual(await load(), [])
  })
})
