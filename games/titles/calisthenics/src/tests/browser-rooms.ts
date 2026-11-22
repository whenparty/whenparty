import {expect, type Page, type WebSocket} from '@playwright/test'

const onImages = !!process.env.GAMES_E2E
export const pageUrl = onImages ? 'https://games.when.party/calisthenics/' : 'http://localhost:5175/calisthenics/'
export const networkWaitMs = 10_000
const signalingUrl = onImages ? 'wss://signaling.when.party/platform' : 'ws://localhost:8080/platform'

// Counts the page's signaling connections, so that leaveRoom can wait until they close.
export const watchSignaling = (page: Page): WebSocket[] => {
  const sockets: WebSocket[] = []
  page.on('websocket', socket => socket.url() === signalingUrl && sockets.push(socket))
  return sockets
}

// Leaves the room with the button of 6-2, so that the rooms server of the run frees it.
export const leaveRoom = async (page: Page, sockets: readonly WebSocket[]): Promise<void> => {
  const leave = page.getByRole('button', {name: 'Leave the room'})
  if (await leave.isVisible()) {
    await leave.click()
  }
  await expect.poll(() => sockets.every(socket => socket.isClosed()), {timeout: networkWaitMs}).toBe(true)
}
