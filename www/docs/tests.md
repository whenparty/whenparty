# Testing the site

- [tests/page.test.ts](../tests/page.test.ts) tests in Chromium what [takeoff.js](../html/takeoff.js) and the takeoff in [styles.css](../html/styles.css) do: a click releases the balloon and opens its link by the end of the takeoff, a click with a modifier key is left to the browser, a click under reduced motion opens the link at once, and a page restored from the back-forward cache shows its balloons again. It also takes a storyboard of the balloon takeoff at 1280 and 375 px wide, a sheet of frames at rest and at fixed times after the click, and compares it with the approved screenshot in `tests/page.test.ts-snapshots/`. A change to how the page looks or moves fails it until that screenshot is updated.
- The storyboard pauses every animation and sets its time, and Playwright's clock holds the timer of `takeoff.js`, so no frame depends on how fast the machine is.
- Run the tests after changing anything in `www/` other than Markdown. [tests/run.sh](../tests/run.sh) runs `playwright test` with its arguments in Docker, in the Playwright image of the `@playwright/test` version in `package.json`, so a new version needs no other file changed. It can change the screenshots, which are then approved as below. From the repository root:

  ```bash
  www/tests/run.sh
  ```

  A failed run leaves the screenshots it took, the approved ones and their difference in `www/test-results/`. In CI, a failed run uploads them and the HTML report as the `www-tests` artifact.
- Approved screenshots are made only in CI, which runs the image on x86. Docker on a Mac with Apple Silicon runs it on arm64, where a few pixels can differ, and `maxDiffPixels` in [playwright.config.ts](../playwright.config.ts) allows for that while a string that points the wrong way, about 700 pixels, still fails. `updateSnapshots: 'none'` there makes a missing approved screenshot fail instead of being written.
- To approve a change, add the `update-snapshots` label to the pull request, which must come from a branch of this repository. The label starts [www-snapshots.yml](/.github/workflows/www-snapshots.yml), which takes every screenshot again with `--update-snapshots=all`, commits those that changed to the pull request's branch and removes the label. When a test fails, it commits nothing. GitHub holds the checks of its commit until someone approves them in the pull request, with Approve workflows to run. Pull the branch before pushing to it again. Look at the new screenshots in the pull request before merging.

  ```bash
  gh pr edit <number> --add-label update-snapshots
  ```

- [check-www.yml](/.github/workflows/check-www.yml) runs the tests in CI, as [checks.md](/.github/docs/checks.md) says. The deploy does not wait for it.
