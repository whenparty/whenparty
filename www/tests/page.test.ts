import {expect, test as base, type Page} from '@playwright/test'
import {fileURLToPath} from 'node:url'

const html = fileURLToPath(new URL('../html/', import.meta.url))
const games = 'https://games.when.party/'
const framesMs = [130, 250, 400, 550, 700]

const test = base.extend({
  context: async ({context}, use) => {
    await context.route('http://www.test/**', (route) => {
      const {pathname} = new URL(route.request().url())
      return route.fulfill({path: html + (pathname === '/' ? 'index.html' : pathname.slice(1))})
    })
    await context.route(games, (route) => route.fulfill({body: 'games'}))
    await use(context)
  }
})

async function openAtRest(page: Page) {
  await page.clock.install()
  await page.goto('/')
  await page.evaluate(async () => {
    await document.fonts.ready
    for (const animation of document.getAnimations()) {
      if (animation.effect?.getTiming().iterations === Infinity) {
        animation.pause()
        animation.currentTime = 0
      } else {
        animation.finish()
      }
    }
  })
}

async function seekTakeoff(page: Page, timeMs: number) {
  await page.evaluate((timeMs) => {
    for (const animation of document.getAnimations()) {
      if (animation instanceof CSSAnimation && animation.animationName !== 'takeoff') continue
      animation.pause()
      animation.currentTime = timeMs
    }
  }, timeMs)
}

async function contactSheet(page: Page, frames: {label: string; png: Buffer}[]) {
  const sheet = await page.context().newPage()
  const figures = frames.map(
    ({label, png}) =>
      `<figure><img src="data:image/png;base64,${png.toString('base64')}"><figcaption>${label}</figcaption></figure>`
  )
  await sheet.setContent(
    `<style>
      body { margin: 0; padding: 8px; display: grid; grid-template-columns: repeat(3, max-content); gap: 8px; background: #888; font: 14px sans-serif; }
      figure { margin: 0; } img { display: block; }
    </style>${figures.join('')}`
  )
  return sheet
}

const storyboards = [
  {name: 'desktop', viewport: {width: 1280, height: 800}},
  {name: 'mobile', viewport: {width: 375, height: 812}}
]

for (const {name, viewport} of storyboards) {
  test(`the balloon takeoff on ${name} matches its approved storyboard`, async ({page}) => {
    await page.setViewportSize(viewport)
    await openAtRest(page)
    const frames = [{label: 'at rest', png: await page.screenshot()}]
    const link = page.locator('.balloon-games a')
    await link.hover()
    await page.evaluate(() => document.getAnimations().forEach((animation) => animation instanceof CSSTransition && animation.finish()))
    await link.click()
    for (const timeMs of framesMs) {
      await seekTakeoff(page, timeMs)
      frames.push({label: `${timeMs} ms`, png: await page.screenshot()})
    }
    const sheet = await contactSheet(page, frames)
    await expect(sheet).toHaveScreenshot(`balloon-takeoff-${name}.png`, {fullPage: true})
  })
}

test('a click releases the balloon and opens its link by the end of the takeoff', async ({page}) => {
  await page.clock.install()
  await page.goto('/')
  const balloon = page.locator('.balloon-games')
  await balloon.locator('a').click()
  await expect(balloon).toHaveClass(/is-flying/)
  await expect(page.locator('body')).toHaveClass(/is-leaving/)
  expect(page.url()).toBe('http://www.test/')
  const takeoffMs = await balloon
    .locator('.balloon-float')
    .evaluate((float) => Number(float.getAnimations()[0]!.effect!.getTiming().duration))
  await page.clock.runFor(takeoffMs)
  await expect(page).toHaveURL(games)
})

test('a click with a modifier key is left to the browser without the takeoff', async ({page}) => {
  await page.goto('/')
  const prevented = page.evaluate(
    () =>
      new Promise<boolean>((resolve) =>
        addEventListener('click', (event) => {
          resolve(event.defaultPrevented)
          event.preventDefault()
        })
      )
  )
  await page.locator('.balloon-games a').click({modifiers: ['ControlOrMeta']})
  expect(await prevented).toBe(false)
  await expect(page.locator('.is-flying')).toHaveCount(0)
  await expect(page.locator('body')).not.toHaveClass(/is-leaving/)
})

test('under reduced motion a click opens the link at once', async ({page}) => {
  await page.emulateMedia({reducedMotion: 'reduce'})
  await page.clock.install()
  await page.goto('/')
  await page.locator('.balloon-games a').click()
  await expect(page).toHaveURL(games)
})

test('a page restored from the back-forward cache shows its balloons again', async ({page}) => {
  await page.clock.install()
  await page.goto('/')
  await page.locator('.balloon-games a').click()
  await page.evaluate(() => dispatchEvent(new PageTransitionEvent('pageshow', {persisted: true})))
  await expect(page.locator('.is-flying')).toHaveCount(0)
  await expect(page.locator('body')).not.toHaveClass(/is-leaving/)
})
