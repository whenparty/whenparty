import {expect, test, type Page} from '@playwright/test'

const pageUrl = 'http://localhost:5175/calisthenics/'
const networkWaitMs = 10_000
const phone = {width: 375, height: 812}
const minTextPx = 12
const minTouchTargetPx = 44

const openLobby = async (page: Page) => {
  await page.goto(pageUrl)
  await page.getByRole('button', {name: 'Create a room'}).click()
  await expect(page.getByLabel('Athlete name')).toBeVisible({timeout: networkWaitMs})
}

test('the scene overlay takes its narrow layout by the width of the stage, not of the window', async ({page}) => {
  const toolbarTopAt = async (width: number) => {
    await page.setViewportSize({width, height: 900})
    return page.locator('.stage-toolbar').evaluate(toolbar => getComputedStyle(toolbar).top)
  }

  await page.goto(pageUrl)
  expect(await toolbarTopAt(800)).toBe('12px')
  expect(await toolbarTopAt(1280)).toBe('18px')
})

test('no text of the lobby on a phone is smaller than 12 px', async ({page}) => {
  await page.setViewportSize(phone)
  await openLobby(page)
  const sizes = await page
    .locator('body *')
    .evaluateAll(elements =>
      elements
        .filter(
          element =>
            element.checkVisibility() && [...element.childNodes].some(node => node.nodeType === Node.TEXT_NODE && node.textContent?.trim())
        )
        .map(element => ({text: element.textContent?.trim().slice(0, 30), size: parseFloat(getComputedStyle(element).fontSize)}))
    )

  expect(sizes.length).toBeGreaterThan(0)
  expect(sizes.filter(({size}) => size < minTextPx)).toEqual([])
})

test.describe('on a touch screen', () => {
  test.use({hasTouch: true, isMobile: true, viewport: phone})

  test('every control of the lobby is at least 44 px wide and high', async ({page}) => {
    await openLobby(page)
    const sizes = await page.locator('button, select, input, a').evaluateAll(controls =>
      controls
        .filter(control => control.checkVisibility())
        .map(control => {
          const {width, height} = control.getBoundingClientRect()
          return {control: control.id || control.textContent?.trim(), width, height}
        })
    )

    expect(sizes.length).toBeGreaterThan(0)
    expect(sizes.filter(({width, height}) => width < minTouchTargetPx || height < minTouchTargetPx)).toEqual([])
  })
})
