import {defineConfig} from '@playwright/test'

const onImages = !!process.env.GAMES_E2E
const productionHostsOnThisMachine =
  '--host-resolver-rules=MAP games.when.party 127.0.0.1, MAP signaling.when.party 127.0.0.1, MAP turn.when.party 127.0.0.1, MAP turn.when.party. 127.0.0.1'

export default defineConfig({
  testDir: onImages ? 'titles' : '.',
  testMatch: '**/*.browser.test.ts',
  forbidOnly: !!process.env.CI,
  workers: onImages ? 1 : undefined,
  globalSetup: onImages ? undefined : './tests/servers.mjs',
  reporter: process.env.CI ? [['list'], ['html', {open: 'never'}]] : 'list',
  projects: [
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
        channel: process.env.CI || onImages ? 'chrome' : undefined,
        launchOptions: {
          args: [
            '--disable-features=WebRtcHideLocalIpsWithMdns',
            ...(onImages ? [productionHostsOnThisMachine, '--ignore-certificate-errors'] : [])
          ]
        }
      }
    },
    ...(onImages ? [] : [{name: 'webkit', grepInvert: /@chromium/, use: {browserName: 'webkit' as const}}])
  ]
})
