# Testing the site

- [tests/page.browser.test.ts](../tests/page.browser.test.ts) tests in Chromium what [takeoff.js](../html/takeoff.js) and the takeoff in [styles.css](../html/styles.css) do: a click releases the balloon and opens its link by the end of the takeoff; during the takeoff, Tab reaches neither the blog link nor the email link, a click on the blog balloon releases nothing, and Enter on the flying balloon's link starts no second navigation; a click with a modifier key is left to the browser; a click under reduced motion opens the link at once; and a page restored from the back-forward cache shows its balloons again, leaves nothing `inert` and restarts the `refilter` of the balloon that flew with its inflate, [linear and 1 s longer](decisions/balloon-sharpness.md#decision). It also takes a storyboard of the games balloon's takeoff at 1280 and 375 px wide, a sheet of frames at rest and at fixed times after the click, and compares it with the approved screenshot in `tests/page.browser.test.ts-snapshots/`. A change to how the page looks or moves fails it until that screenshot is updated.
- The storyboard pauses every animation and sets its time, and Playwright's clock holds the timer of `takeoff.js`, so no frame depends on how fast the machine is.
- [check-www.yml](/.github/workflows/check-www.yml) runs the tests in CI, and the deploy does not wait for it, as [checks.md](/.github/docs/checks.md#the-checks) says.
- [tests/run.sh](../tests/run.sh) runs `playwright test` with its arguments in Docker, in the Playwright image of the `@playwright/test` version in `package.json`, with pnpm from the image `ghcr.io/pnpm/pnpm` of the version that `packageManager` there names, as [pnpm-in-images.md](/docs/decisions/pnpm-in-images.md) decides, so a new version of either changes only `package.json` and `pnpm-lock.yaml`, not `run.sh`. The container installs the packages with the host's `node_modules` hidden, so the host keeps its own, and keeps pnpm's store in the Docker volume `www-tests-pnpm`. From the repository root:

  ```bash
  www/tests/run.sh
  ```

  A failed run leaves the screenshots it took, the approved ones and their difference in `www/test-results/`. In CI, a failed run uploads them and the HTML report as the `www-tests` artifact.

- On the host, `pnpm deps:cached` in `www/` installs the packages from pnpm's store alone, such as for the types of the tests in an editor. [pnpm-workspace.yaml](../pnpm-workspace.yaml) sets `verifyDepsBeforeRun` to `warn` so that it downloads nothing, as [pnpm-deps-check.md](/docs/decisions/pnpm-deps-check.md) decides.
- Approved screenshots are made only in CI, which runs the image on x86. Docker on a Mac with Apple Silicon runs it on arm64, where a few pixels can differ, and `maxDiffPixels` in [playwright.config.ts](../playwright.config.ts) allows for that while a string that points the wrong way, about 400 pixels, still fails. `updateSnapshots: 'none'` there makes a missing approved screenshot fail instead of being written.
- When a test fails in CI, [check-www.yml](/.github/workflows/check-www.yml) takes every screenshot again with `--update-snapshots=all`. When that second run passes, usually because only screenshots differed, it uploads them as the `www-snapshots` artifact. When the pull request changes how the page looks or moves on purpose, and the differences in `www-tests` show only that change, run the commands below from the repository root to replace the approved screenshots with them, then commit and push them. `gh run download` does not overwrite files, so the old ones go first, and `git restore 'www/tests/*-snapshots/*'` brings them back when the download fails. `<run>` is the ID of the failed run of `ci.yml`, which `gh run list --branch <branch> --workflow ci.yml` shows. The user approves the new screenshots by looking at them in the pull request, before the agent merges it, as [Pull requests](/docs/conventions/workflow.md#pull-requests) says.

  ```bash
  rm -r www/tests/*-snapshots
  gh run download <run> --name www-snapshots --dir www/tests
  ```
