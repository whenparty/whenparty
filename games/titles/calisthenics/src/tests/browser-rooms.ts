import {expect, type Page, type WebSocket} from '@playwright/test'

export const networkWaitMs = 10_000
const signalingUrl = 'ws://localhost:8080/platform'

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
