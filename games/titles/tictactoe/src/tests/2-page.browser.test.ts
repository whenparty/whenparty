import {expect} from '@playwright/test'
import {backgroundsOf, codeOf, networkWaitMs, pageUrl, play, test} from './browser-players.ts'

test('2-2 submitting the empty form tells that it is not a room code', async ({newPlayer}) => {
  const page = await newPlayer()
  await page.getByRole('button', {name: 'Enter'}).click()
  await expect(page.getByRole('alert')).toHaveText('That is not a room code. Codes have 5 characters, like K7MXQ.')
})

test('2-6 2-14 the page puts the code into its address without a new history entry, and removes it when it leaves', async ({newPlayer}) => {
  const host = await newPlayer()
  const entries = await host.evaluate(() => history.length)
  await host.getByRole('button', {name: 'Start a game'}).click()
  const code = await codeOf(host)
  await expect(host).toHaveURL(`${pageUrl}#${code}`)
  expect(await host.evaluate(() => history.length)).toBe(entries)
  await host.getByRole('button', {name: 'Leave'}).click()
  await expect(host).toHaveURL(pageUrl)
})

test('2-3 2-14 the copy button copies the invite link, the address of the page with the code', {tag: '@chromium'}, async ({newPlayer}) => {
  const host = await newPlayer()
  await host.getByRole('button', {name: 'Start a game'}).click()
  const code = await codeOf(host)
  await host.getByRole('button', {name: 'Copy invite link'}).click()
  await expect.poll(() => host.evaluate(() => navigator.clipboard.readText())).toBe(`${pageUrl}#${code}`)
})

test('2-5 when the address changes to text that is not a room code, the page shows the lobby', async ({newPlayer}) => {
  const host = await newPlayer()
  await host.getByRole('button', {name: 'Start a game'}).click()
  await codeOf(host)
  await host.evaluate(() => (location.hash = 'not-a-code'))
  await expect(host.getByRole('button', {name: 'Start a game'})).toBeVisible()
})

test('2-7 the winning cells have a colour that no other cell has until the next match starts', {tag: '@chromium'}, async ({players}) => {
  await play(players, [0, 3, 1, 4, 2])
  await expect
    .poll(async () => {
      const backgrounds = await backgroundsOf(players.guest)
      const winning = new Set(backgrounds.slice(0, 3))
      return winning.size === 1 && backgrounds.slice(3).every(background => !winning.has(background))
    })
    .toBe(true)
  await players.host.getByRole('button', {name: 'Start the next match'}).click()
  await expect.poll(async () => new Set(await backgroundsOf(players.guest)).size, {timeout: networkWaitMs}).toBe(1)
})
