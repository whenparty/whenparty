import {expect, test} from '@playwright/test'
import {
  allocationLifetimeMs,
  connect,
  credentialsExpiringIn,
  noticesOf,
  openPair,
  openSides,
  send,
  useTurn,
  waitForTexts
} from './browser-pages.ts'

test('8-2 8-5 two pages that reach each other only through the TURN server connect through it with the credentials of the transport server', async ({
  context
}) => {
  const [caller, callee] = await openPair(context, {relayOnly: true})
  for (const page of [caller, callee]) {
    expect(await noticesOf(page)).toContainEqual(expect.objectContaining({kind: 'open', path: 'turn'}))
  }
  await send(caller, ['to callee'])
  await send(callee, ['to caller'])
  await waitForTexts(callee, ['to callee'])
  await waitForTexts(caller, ['to caller'])
})

test(
  '8-5 a page with credentials connects through the TURN server to a page without any that sends UDP to its relayed address',
  {tag: '@chromium'},
  async ({context}) => {
    const [caller, callee] = await openPair(context, {relayOnly: true}, {turn: 'none'})
    for (const page of [caller, callee]) {
      expect(await noticesOf(page)).toContainEqual(expect.objectContaining({kind: 'open', path: 'turn'}))
    }
    await send(callee, ['through the relay'])
    await waitForTexts(caller, ['through the relay'])
  }
)

test('8-6 a peer connection open through the TURN server goes on after its credentials expired before the browser refreshed its allocations', async ({
  context
}) => {
  const pages = await openSides(context, {relayOnly: true})
  await useTurn(pages, credentialsExpiringIn(allocationLifetimeMs() / 2 - 1_000))
  await connect(pages)
  await pages[0].waitForTimeout(allocationLifetimeMs() + 2_000)
  for (const page of pages) {
    expect(await page.evaluate(() => harness.state())).toBe('open')
  }
  await send(pages[0], ['after the expiry'])
  await waitForTexts(pages[1], ['after the expiry'])
})
