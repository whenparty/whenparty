import {expect, test} from '@playwright/test'
import {networkWaitMs, noticesOf, openPair, send, textsOf, waitForTexts} from './browser-pages.ts'

const largest = '😀'.repeat(16_384)
const texts = ['first', largest, '', 'last']

test("4-1 4-2 4-3 texts up to the largest arrive once and in order in both directions, on the channel of the transport's own messages", async ({
  context
}) => {
  const [caller, callee] = await openPair(context)
  await send(caller, texts)
  await send(callee, [...texts].reverse())
  await waitForTexts(callee, texts)
  await waitForTexts(caller, [...texts].reverse())
})

test('4-4 4-5 4-7 a side that the module closes right after sending lets its texts arrive, and the other side then closes with closed', async ({
  context
}) => {
  const [caller, callee] = await openPair(context)
  const sent = await caller.evaluate(sending => {
    const results = sending.map(text => harness.send(text))
    harness.close()
    return results
  }, texts)
  expect(sent).toEqual(texts.map(() => true))
  await expect.poll(async () => (await noticesOf(callee)).at(-1), {timeout: networkWaitMs}).toEqual({kind: 'closed', reason: 'closed'})
  expect(await textsOf(callee)).toEqual(texts)
  expect((await noticesOf(caller)).filter(notice => notice.kind === 'closed')).toEqual([])
})

test('4-6 the path of pages that reach each other is direct, and through the TURN server it is turn, with a round-trip time or none', async ({
  context
}) => {
  const direct = await openPair(context)
  const relayed = await openPair(context, {relayOnly: true})
  for (const [pages, path] of [
    [direct, 'direct'],
    [relayed, 'turn']
  ] as const) {
    for (const page of pages) {
      const [open] = (await noticesOf(page)).filter(notice => notice.kind === 'open')
      expect(open).toMatchObject({path})
      expect(open?.kind === 'open' && (open.roundTripMs === null || open.roundTripMs >= 0)).toBe(true)
    }
  }
})
