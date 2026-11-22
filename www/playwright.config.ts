import {defineConfig} from '@playwright/test'

export default defineConfig({
  testDir: 'tests',
  forbidOnly: !!process.env.CI,
  updateSnapshots: 'none',
  snapshotPathTemplate: '{snapshotDir}/{testFileDir}/{testFileName}-snapshots/{arg}{-snapshotSuffix}{ext}',
  reporter: process.env.CI ? [['list'], ['html', {open: 'never'}]] : 'list',
  expect: {toHaveScreenshot: {animations: 'allow', maxDiffPixels: 100}},
  use: {baseURL: 'http://www.test/'},
  projects: [
    {name: 'chromium', use: {browserName: 'chromium'}},
    {name: 'webkit', grepInvert: /@chromium/, use: {browserName: 'webkit'}}
  ]
})
