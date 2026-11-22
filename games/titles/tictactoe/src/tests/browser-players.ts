import {expect, test as base, type Locator, type Page, type WebSocket} from '@playwright/test'

const onImages = !!process.env.GAMES_E2E
export const pageUrl = onImages ? 'https://games.when.party/tictactoe/' : 'http://localhost:5174/tictactoe/'
export const networkWaitMs = 10_000
const signalingUrl = onImages ? 'wss://signaling.when.party/platform' : 'ws://localhost:8080/platform'

export interface Players {
  readonly host: Page
  readonly guest: Page
  readonly code: string
}

interface Player {
  readonly page: Page
  readonly signaling: WebSocket[]
}

const leaveRoom = async ({page, signaling}: Player): Promise<void> => {
  const leave = page.getByRole('button', {name: 'Leave'})
  if (await leave.isVisible()) {
    await leave.click()
  }
  await expect.poll(() => signaling.every(socket => socket.isClosed()), {timeout: networkWaitMs}).toBe(true)
}

export const test = base.extend<{newPlayer: (url?: string) => Promise<Page>; players: Players}>({
  newPlayer: async ({browser, browserName}, use) => {
    const players: Player[] = []
    await use(async (url = pageUrl) => {
      const context = await browser.newContext({
        permissions: browserName === 'chromium' ? ['clipboard-read', 'clipboard-write'] : []
      })
      const page = await context.newPage()
      const player: Player = {page, signaling: []}
      page.on('websocket', socket => socket.url() === signalingUrl && player.signaling.push(socket))
      players.push(player)
      await page.goto(url)
      return page
    })
    for (const player of players) {
      await leaveRoom(player)
    }
    await Promise.all(players.map(({page}) => page.context().close()))
  },
  players: async ({newPlayer}, use) => {
    const host = await newPlayer()
    await host.getByRole('button', {name: 'Start a game'}).click()
    const code = await codeOf(host)
    const guest = await newPlayer(`${pageUrl}#${code}`)
    await expect(statusOf(guest)).toHaveText('You are O. X to move.', {timeout: networkWaitMs})
    await use({host, guest, code})
  }
})

const statusOf = (page: Page): Locator => page.locator('#status')

export const codeOf = async (page: Page): Promise<string> => {
  const code = page.locator('#room-code')
  await expect(code).toHaveText(/^\w{5}$/, {timeout: networkWaitMs})
  return (await code.textContent()) ?? ''
}

export const cellOf = (page: Page, index: number): Locator => page.getByRole('button', {name: `Cell ${index + 1}`, exact: true})

export const play = async (players: Players, cells: readonly number[], movesBefore = 0): Promise<void> => {
  for (const [offset, index] of cells.entries()) {
    const move = movesBefore + offset
    const [mover, other] = move % 2 === 0 ? [players.host, players.guest] : [players.guest, players.host]
    const mark = move % 2 === 0 ? 'X' : 'O'
    await expect(cellOf(mover, index)).toBeEnabled({timeout: networkWaitMs})
    await cellOf(mover, index).click()
    await expect(cellOf(other, index)).toHaveText(mark, {timeout: networkWaitMs})
  }
}

export const backgroundsOf = (page: Page): Promise<string[]> =>
  page.locator('#board button').evaluateAll(cells => cells.map(cell => getComputedStyle(cell).backgroundColor))
