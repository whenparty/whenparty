import {expect, test} from '@playwright/test'
import {noticesOf, openPair} from './browser-pages.ts'

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
