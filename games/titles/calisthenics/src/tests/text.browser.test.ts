import {expect, test as base, type Page} from '@playwright/test'
import {leaveRoom, networkWaitMs, pageUrl as gameUrl, watchSignaling} from './browser-rooms.ts'

const pageUrl = `${gameUrl}text.html`
const minContrast = 4.5

interface Players {
  readonly host: Page
  readonly guest: Page
}

const test = base.extend<{players: Players}>({
  players: async ({browser}, use) => {
    const contexts = await Promise.all([browser.newContext(), browser.newContext()])
    const [host, guest] = await Promise.all(contexts.map(context => context.newPage()))

    if (!host || !guest) {
      throw new Error('missing a player page')
    }
    const sockets = [watchSignaling(host), watchSignaling(guest)] as const

    await host.goto(pageUrl)
    await host.getByRole('button', {name: 'Create a room'}).click()
    const code = host.locator('#room-code')
    await expect(code).toHaveText(/^\w{5}$/, {timeout: networkWaitMs})
    await guest.goto(`${pageUrl}#${await code.textContent()}`)

    for (const [page, name] of [
      [host, 'Ada'],
      [guest, 'Bo']
    ] as const) {
      const nameInput = page.getByLabel('Athlete name')
      await expect(nameInput).toBeVisible({timeout: networkWaitMs})
      await nameInput.fill(name)
      await page.getByRole('button', {name: 'Save'}).click()
    }

    const start = host.getByRole('button', {name: 'Start the championship'})
    await expect(start).toBeEnabled({timeout: networkWaitMs})
    await start.click()
    await expect(guest.locator('#announcement')).toBeVisible({timeout: networkWaitMs})
    try {
      await use({host, guest})
    } finally {
      await leaveRoom(guest, sockets[1])
      await leaveRoom(host, sockets[0])
      await Promise.all(contexts.map(context => context.close()))
    }
  }
})

const focusedOf = (page: Page) =>
  page.evaluate(() => (document.activeElement === document.body ? 'body' : (document.activeElement?.textContent ?? '')))

const luminanceOf = (color: string) => {
  const [red = 0, green = 0, blue = 0] = (color.match(/[\d.]+/g) ?? []).map(each => {
    const channel = Number(each) / 255
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}

const contrastOf = (first: string, second: string) => {
  const [lighter = 0, darker = 0] = [luminanceOf(first), luminanceOf(second)].sort((a, b) => b - a)
  return (lighter + 0.05) / (darker + 0.05)
}

test('Tab reaches only the controls of the announcement, Start training and Leave the room, while it covers the page, and the link to the 3D interface can take focus after it', async ({
  players: {host}
}) => {
  const reached = new Set<string>()

  for (let press = 0; press < 3; press++) {
    await host.keyboard.press('Tab')
    reached.add(await focusedOf(host))
  }

  expect([...reached].filter(each => each !== 'body').sort()).toEqual(['Leave the room', 'Start training'])
  await host.getByRole('button', {name: 'Start training'}).click()
  await expect(host.locator('#announcement')).toBeHidden({timeout: networkWaitMs})
  const interfaceLink = host.locator('#interface-link')
  await interfaceLink.focus()
  await expect(interfaceLink).toBeFocused()
})

test('the Now performing card keeps its text readable in the light and the dark color scheme', async ({players: {host, guest}}) => {
  await host.getByRole('button', {name: 'Start training'}).click()

  for (const page of [host, guest]) {
    const rest = page.getByLabel('Rest', {exact: true})
    await expect(rest).toBeVisible({timeout: networkWaitMs})
    await rest.fill('3')
    await page.getByRole('button', {name: 'Ready for the challenge'}).click()
  }

  const perform = host.getByRole('button', {name: 'Start the challenge'})
  await expect(perform).toBeEnabled({timeout: networkWaitMs})
  await perform.click()
  const card = host.locator('#performance-card')
  await expect(card).toBeVisible({timeout: networkWaitMs})

  for (const colorScheme of ['light', 'dark'] as const) {
    await host.emulateMedia({colorScheme})
    const {background, texts} = await card.evaluate(element => ({
      background: getComputedStyle(element).backgroundColor,
      texts: [...element.querySelectorAll(':scope > :not(button)')].map(line => getComputedStyle(line).color)
    }))
    expect(texts).toHaveLength(3)

    for (const text of texts) {
      expect(contrastOf(text, background), colorScheme).toBeGreaterThanOrEqual(minContrast)
    }
  }
})
