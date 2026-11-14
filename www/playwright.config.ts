import {defineConfig} from '@playwright/test'

export default defineConfig({
  testDir: 'tests',
  forbidOnly: !!process.env.CI,
  updateSnapshots: 'none',
  reporter: process.env.CI ? [['list'], ['html', {open: 'never'}]] : 'list',
  expect: {toHaveScreenshot: {animations: 'allow', maxDiffPixels: 100}},
  use: {browserName: 'chromium', baseURL: 'http://www.test/'}
})
