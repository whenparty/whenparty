import {expect, test as base, type Page, type WebSocket} from '@playwright/test'

const pageUrl = 'http://localhost:5173/platform/rooms/src/tests/browser-page.html'
const signalingUrl = 'ws://localhost:8080/platform'
const appId = 'when.party/browser-tests'
const created = expect.stringMatching(/^created [23456789BCDFGHJKMNPQRSTVWXYZ]{5}$/)
const networkWaitMs = 10_000

interface RoomPage {
  readonly page: Page
  readonly signaling: WebSocket[]
}

const leaveRoom = async ({page, signaling}: RoomPage): Promise<void> => {
  if (page.isClosed()) {
    return
  }
  await page.evaluate(() => harness.leave())
  await expect.poll(() => signaling.every(socket => socket.isClosed()), {timeout: networkWaitMs}).toBe(true)
}

const test = base.extend<{openPage: () => Promise<Page>}>({
  openPage: async ({context}, use) => {
    const opened: RoomPage[] = []
    await use(async () => {
      const page = await context.newPage()
      const roomPage: RoomPage = {page, signaling: []}
      page.on('websocket', socket => socket.url() === signalingUrl && roomPage.signaling.push(socket))
      opened.push(roomPage)
      await page.goto(pageUrl)
      return page
    })
    for (const roomPage of opened) {
      await leaveRoom(roomPage)
    }
  }
})

const create = async (page: Page): Promise<void> => {
  expect(await page.evaluate(id => harness.create(id), appId)).toBe(true)
}

const toldOf = (page: Page): Promise<readonly string[]> => page.evaluate(() => harness.told())

test('9-2 while a page holds the lock of an app ID, creating on another page of the browser fails with open elsewhere', async ({
  openPage
}) => {
  const [first, second] = [await openPage(), await openPage()]
  await create(first)
  await expect.poll(() => toldOf(first), {timeout: networkWaitMs}).toEqual([created])
  await create(second)
  await expect.poll(() => toldOf(second), {timeout: networkWaitMs}).toEqual(['failed open elsewhere'])
})

test('9-3 a page lets the lock go when the app leaves, so it creates again at once, and when it closes, so another page creates', async ({
  openPage
}) => {
  const [first, second] = [await openPage(), await openPage()]
  await create(first)
  await expect.poll(() => toldOf(first), {timeout: networkWaitMs}).toEqual([created])
  expect(
    await first.evaluate(id => {
      harness.leave()
      return harness.create(id)
    }, appId)
  ).toBe(true)
  await expect.poll(() => toldOf(first), {timeout: networkWaitMs}).toEqual([created, created])
  await first.close()
  await second.waitForFunction(async () => (await navigator.locks.query()).held?.length === 0, undefined, {timeout: networkWaitMs})
  await create(second)
  await expect.poll(() => toldOf(second), {timeout: networkWaitMs}).toEqual([created])
})
