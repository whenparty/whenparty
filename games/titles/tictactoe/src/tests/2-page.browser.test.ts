import {expect} from '@playwright/test'
import {backgroundsOf, codeOf, networkWaitMs, pageUrl, play, test} from './browser-players.ts'

test('2-1 2-2 the page opens at the lobby, and its form tells that text is not a room code', async ({newPlayer}) => {
  const page = await newPlayer()
  await expect(page.getByRole('button', {name: 'Start a game'})).toBeVisible()
  await page.getByLabel('Or enter one with its code').fill('K7MX')
  await page.getByRole('button', {name: 'Enter'}).click()
  await expect(page.getByRole('alert')).toHaveText('That is not a room code. Codes have 5 characters, like K7MXQ.')
})

test('2-2 submitting the empty form tells that it is not a room code', async ({newPlayer}) => {
  const page = await newPlayer()
  await page.getByRole('button', {name: 'Enter'}).click()
  await expect(page.getByRole('alert')).toHaveText('That is not a room code. Codes have 5 characters, like K7MXQ.')
})

test('2-3 2-13 2-14 the host\'s page shows the code and "you host", puts the code into its address without a new history entry, and copies that address', async ({
  newPlayer
}) => {
  const host = await newPlayer()
  const entries = await host.evaluate(() => history.length)
  await host.getByRole('button', {name: 'Start a game'}).click()
  const code = await codeOf(host)
  await expect(host).toHaveURL(`${pageUrl}#${code}`)
  expect(await host.evaluate(() => history.length)).toBe(entries)
  await expect(host.getByText('you host')).toBeVisible()
  await host.getByRole('button', {name: 'Copy invite link'}).click()
  await expect.poll(() => host.evaluate(() => navigator.clipboard.readText())).toBe(`${pageUrl}#${code}`)
})

test("2-3 2-4 2-14 a page that enters by the form puts the code in the netcode's form into its address, and one opened at that address enters", async ({
  newPlayer
}) => {
  const host = await newPlayer()
  await host.getByRole('button', {name: 'Start a game'}).click()
  const code = await codeOf(host)
  const guest = await newPlayer()
  const entries = await guest.evaluate(() => history.length)
  await guest.getByLabel('Or enter one with its code').fill(` ${code.slice(0, 2).toLowerCase()}-${code.slice(2)} `)
  await guest.getByRole('button', {name: 'Enter'}).click()
  await expect(guest).toHaveURL(`${pageUrl}#${code}`)
  expect(await guest.evaluate(() => history.length)).toBe(entries)
  await expect(guest.locator('#room-code')).toHaveText(code)
  await expect(guest.locator('#status')).toHaveText('You are O. X to move.', {timeout: networkWaitMs})
  const invited = await newPlayer(`${pageUrl}#${code}`)
  await expect(invited.locator('#room-code')).toHaveText(code)
  await host.getByRole('button', {name: 'Let in'}).click({timeout: networkWaitMs})
  await expect(invited.locator('#status')).toHaveText('You are watching. X to move.', {timeout: networkWaitMs})
})

test('2-5 when the address changes to text that is not a room code, the page leaves its game and shows the lobby', async ({players}) => {
  await players.guest.evaluate(() => (location.hash = 'not-a-code'))
  await expect(players.guest.getByRole('button', {name: 'Start a game'})).toBeVisible()
  await expect(players.host.locator('#status')).toHaveText('O left, so the match is over. Send the code to a new player.', {
    timeout: networkWaitMs
  })
})

test('2-6 the leave button shows the lobby and removes the code from the address', async ({players}) => {
  await players.guest.getByRole('button', {name: 'Leave'}).click()
  await expect(players.guest.getByRole('button', {name: 'Start a game'})).toBeVisible()
  await expect(players.guest).toHaveURL(pageUrl)
})

test('2-7 2-9 the winning cells have a colour that no other cell has until the host starts the next match', async ({players}) => {
  await play(players, [0, 3, 1, 4, 2])
  for (const page of [players.host, players.guest]) {
    await expect
      .poll(async () => {
        const backgrounds = await backgroundsOf(page)
        const winning = new Set(backgrounds.slice(0, 3))
        return winning.size === 1 && backgrounds.slice(3).every(background => !winning.has(background))
      })
      .toBe(true)
  }
  await players.host.getByRole('button', {name: 'Start the next match'}).click()
  for (const page of [players.host, players.guest]) {
    await expect.poll(async () => new Set(await backgroundsOf(page)).size, {timeout: networkWaitMs}).toBe(1)
  }
})
