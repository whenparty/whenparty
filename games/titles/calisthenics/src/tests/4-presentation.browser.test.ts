import {expect, test, type Page} from '@playwright/test'

const pageUrl = 'http://localhost:5175/calisthenics/'
const sceneWaitMs = 20_000
const motionWaitMs = 5_000
const stillFrames = 30

const unavailableOf = (page: Page) => page.locator('#scene-error')

const expectTextInterfaceLink = async (page: Page, code: string) => {
  const unavailable = unavailableOf(page)
  await expect(unavailable).toBeVisible({timeout: sceneWaitMs})
  await expect(unavailable).toContainText('3D is unavailable')
  await expect(unavailable.getByRole('link')).toHaveJSProperty('href', `${pageUrl}text.html#${code}`)
}

const framesPass = (page: Page, count: number) =>
  page.evaluate(
    count =>
      new Promise<void>(resolve => {
        const next = (left: number) => {
          if (left > 0) requestAnimationFrame(() => next(left - 1))
          else resolve()
        }
        next(count)
      }),
    count
  )

const pictureOf = (page: Page) => page.locator('#scene canvas').screenshot()

const expectStill = async (page: Page) => {
  await framesPass(page, 2)
  const before = await pictureOf(page)
  await framesPass(page, stillFrames)
  expect((await pictureOf(page)).equals(before)).toBe(true)
}

const expectMoving = async (page: Page) => {
  await framesPass(page, 2)
  const before = await pictureOf(page)
  await expect
    .poll(
      async () => {
        await framesPass(page, 2)
        return (await pictureOf(page)).equals(before)
      },
      {timeout: motionWaitMs}
    )
    .toBe(false)
}

test('4-5 without WebGL the 3D page says that 3D is unavailable and links to the text interface for the same room', async ({page}) => {
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, ...args: Parameters<typeof getContext>) {
      return args[0].includes('webgl') ? null : getContext.apply(this, args)
    } as typeof getContext
  })
  await page.goto(`${pageUrl}#K7MXQ`)
  await expectTextInterfaceLink(page, 'K7MXQ')
})

test('4-5 when the athlete fails to load the 3D page says that 3D is unavailable and links to the text interface for the same room', async ({
  page
}) => {
  await page.route('**/athlete.glb', route => route.fulfill({status: 404}))
  await page.goto(`${pageUrl}#B2CDF`)
  await expectTextInterfaceLink(page, 'B2CDF')
})

test('4-5 the athlete holds a still pose while the browser asks for reduced motion and moves otherwise', async ({page}) => {
  await page.emulateMedia({reducedMotion: 'reduce'})
  await page.goto(pageUrl)
  await expect(page.locator('#scene-loader')).toBeHidden({timeout: sceneWaitMs})
  await expect(unavailableOf(page)).toBeHidden()
  await expectStill(page)
  await page.emulateMedia({reducedMotion: 'no-preference'})
  await expectMoving(page)
  await page.emulateMedia({reducedMotion: 'reduce'})
  await expectStill(page)
})
