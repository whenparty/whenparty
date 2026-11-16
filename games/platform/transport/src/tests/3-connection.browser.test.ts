import {expect, test} from '@playwright/test'
import {call, credentialsExpiringIn, networkWaitMs, noticesOf, openPair, openSides} from './browser-pages.ts'

test('3-6 3-7 3-14 two pages connect directly through local signaling: the largest text fits the browsers, and each side opens and is told once', async ({
  context
}) => {
  const pages = await openPair(context)
  for (const page of pages) {
    const notices = await noticesOf(page)
    expect(notices.filter(notice => notice.kind === 'open')).toHaveLength(1)
    expect(notices.filter(notice => notice.kind === 'closed')).toEqual([])
  }
})

test('3-12 when a page unloads, the other side closes as if the module of the page had closed its side', async ({context}) => {
  const [caller, callee] = await openPair(context)
  await caller.goto('about:blank')
  await expect.poll(() => noticesOf(callee)).toContainEqual({kind: 'closed', reason: 'closed'})
})

test('3-9 a side without a relay candidate, to which coturn gave no free allocation, closes with no relay at its deadline after the other description arrived', async ({
  context
}) => {
  await context.clock.install()
  const credentials = credentialsExpiringIn(60_000)
  const [caller, callee] = await openSides(context, {relayOnly: true, turn: credentials}, {})
  expect(await caller.evaluate(used => harness.useUpAllocations(used, 64), credentials)).toBe(true)
  await call([caller, callee])
  await expect.poll(() => caller.evaluate(() => harness.refusedWithOtherDescription()), {timeout: networkWaitMs}).toBe(true)
  await context.clock.fastForward(15_000)
  await expect.poll(() => noticesOf(caller)).toEqual([{kind: 'closed', reason: 'no relay'}])
})
