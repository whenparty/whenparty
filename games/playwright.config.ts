import {defineConfig} from '@playwright/test'

export default defineConfig({
  testMatch: '**/*.browser.test.ts',
  forbidOnly: !!process.env.CI,
  globalSetup: './tests/servers.mjs',
  reporter: process.env.CI ? [['list'], ['html', {open: 'never'}]] : 'list',
  use: {
    browserName: 'chromium',
    channel: process.env.CI ? 'chrome' : undefined,
    launchOptions: {args: ['--disable-features=WebRtcHideLocalIpsWithMdns']}
  }
})
