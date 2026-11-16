import {expect, type BrowserContext, type Page} from '@playwright/test'
import {turnCredentials} from '../server/turn.ts'
import type {Credentials, Notice, PageOptions, Turn} from './browser-page.ts'

const pageUrl = 'http://localhost:5173/platform/transport/src/tests/browser-page.html'
const signalingUrl = 'ws://localhost:8081/platform'
const credentialsLifetimeMs = 86_400_000
export const networkWaitMs = 10_000

type SideOptions = Partial<Pick<PageOptions, 'relayOnly' | 'turn'>>

const fromEnvironment = (name: string): string => {
  const value = process.env[name]
  if (!value) {
    throw new Error(`${name} is not set: run the browser tests with tests/browser.sh`)
  }
  return value
}

export const allocationLifetimeMs = (): number => Number(fromEnvironment('GAMES_TURN_ALLOCATION_SECONDS')) * 1000

export const credentialsExpiringIn = (milliseconds: number): Credentials => {
  const {username, credential} = turnCredentials(fromEnvironment('GAMES_TURN_SECRET'), Date.now() + milliseconds - credentialsLifetimeMs)
  return {username, credential}
}

const gatherOnEveryInterface = (context: BrowserContext): Promise<void> => context.grantPermissions(['camera', 'microphone'])

const openSide = async (context: BrowserContext, options: SideOptions): Promise<Page> => {
  await gatherOnEveryInterface(context)
  const page = await context.newPage()
  await page.goto(pageUrl)
  const pageOptions: PageOptions = {
    signalingUrl,
    turnHost: fromEnvironment('GAMES_TURN_HOST'),
    relayOnly: false,
    turn: 'from server',
    ...options
  }
  await page.evaluate(opened => harness.open(opened), pageOptions)
  return page
}

export const openSides = async (context: BrowserContext, caller: SideOptions = {}, callee: SideOptions = caller): Promise<[Page, Page]> => [
  await openSide(context, caller),
  await openSide(context, callee)
]

export const useTurn = async (pages: readonly Page[], turn: Turn): Promise<void> => {
  for (const page of pages) {
    await page.evaluate(used => harness.useTurn(used), turn)
  }
}

const peerIdOf = async (page: Page): Promise<string> => {
  const peerId = await page.waitForFunction(() => harness.peerId(), undefined, {timeout: networkWaitMs})
  return String(await peerId.jsonValue())
}

export const call = async ([caller, callee]: readonly [Page, Page]): Promise<void> => {
  const callerId = await peerIdOf(caller)
  const calleeId = await peerIdOf(callee)
  expect(await callee.evaluate(peerId => harness.allow(peerId), callerId)).toBe(true)
  await caller.evaluate(peerId => harness.connect(peerId), calleeId)
}

export const connect = async (pages: readonly [Page, Page]): Promise<void> => {
  await call(pages)
  for (const page of pages) {
    await expect.poll(() => page.evaluate(() => harness.state()), {timeout: networkWaitMs}).toBe('open')
  }
}

export const openPair = async (context: BrowserContext, caller: SideOptions = {}, callee: SideOptions = caller): Promise<[Page, Page]> => {
  const pages = await openSides(context, caller, callee)
  await connect(pages)
  return pages
}

export const noticesOf = (page: Page): Promise<readonly Notice[]> => page.evaluate(() => harness.notices())

export const textsOf = async (page: Page): Promise<readonly string[]> =>
  (await noticesOf(page)).flatMap(notice => (notice.kind === 'text' ? [notice.text] : []))

export const send = async (page: Page, texts: readonly string[]): Promise<void> => {
  expect(await page.evaluate(sent => sent.map(text => harness.send(text)), texts)).toEqual(texts.map(() => true))
}

export const waitForTexts = async (page: Page, texts: readonly string[]): Promise<void> => {
  await expect.poll(() => textsOf(page), {timeout: networkWaitMs}).toEqual(texts)
}
