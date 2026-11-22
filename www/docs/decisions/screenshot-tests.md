# Screenshot tests

## Context

`www/` is one static page without components or a [specification](/docs/conventions/specs.md), and most of what it does is animation: balloons inflate, bob and take off, their strings meet ropes, and the page fades. A mistake, such as a string that points at the rope while its balloon flies away, shows at once to a person who watches.

A browser test can measure each part at a set time of an animation, or take a screenshot. Playwright compares a screenshot with an approved one within a tolerance and, when they differ, leaves both and their difference. Browsers draw some pixels differently on another system or processor. A pull request shows old and new images side by side. Git LFS keeps files outside the repository, and every checkout of them counts towards a transfer quota.

As [ci-checks.md](/docs/decisions/ci-checks.md) decides, `ci.yml` checks every pull request, merge group of the merge queue and push to `main`, and only `games.yml` and `infra.yml` wait for their checks. A ruleset on `main` requires a pull request, the `result` check of `ci.yml` and a merge queue, which checks each pull request together with `main` before it merges, as [main-branch-protection.md](/docs/decisions/main-branch-protection.md) decides. The site deploys in about 1.5 minutes, and the browser tests take about half a minute in CI.

## Options

This decision has three parts. Where the approved screenshots are made is decided in [screenshot-updates.md](screenshot-updates.md).

How the animations are checked:

- No browser tests, the previous setup. Nothing to maintain. A mistake shows only to someone who watches the takeoff.
- Assertions on the position and size of each part at set times. A failure names what moved, and pixels do not matter. Every part and moment needs an assertion, and an unforeseen mistake passes.
- Screenshots of a storyboard: a sheet of frames at set times. Any visible change fails, and a person approves the sheet by looking at it. The pixels depend on where the browser runs, and every intended change needs new screenshots.
- Storybook stories that Chromatic compares in its cloud, with a review page. Pixels do not depend on the local machine. The page would be cut into stories, its click, timer and reduced motion still need a browser test, and it costs a large dependency, an account, a CI secret and a monthly screenshot limit.

Where the approved screenshots live:

- PNG files in git next to the test. A pull request shows them. The repository grows by a few hundred kilobytes with each update.
- Git LFS. The repository stays small. It needs setup, CI checkouts with LFS, and the transfer quota.
- Their hashes in git. The smallest. A hash allows no tolerance, so one pixel fails the test, and a failure has no approved image to compare with.

Whether the deploy waits for the tests:

- `www.yml` calls the check before it deploys. Failing tests stop the page from going live, even after a direct push. Every deploy takes about half a minute longer.
- The deploy does not wait. A pull request that fails the tests cannot merge. A direct push can put a broken page live before `ci.yml` reports it.

## Decision

Storyboards of the takeoff at a desktop and a phone width, compared with PNG files in git, and a few tests without screenshots, such as when the link opens. Approving a sheet of frames by eye costs less than an assertion for every part, and it catches mistakes nobody foresaw. The page has no components for stories. A few hundred kilobytes per update do not justify Git LFS, and hashes would hide the difference that makes a failure useful.

The deploy does not wait for the tests. A pull request that fails them cannot merge, and a merged change goes live at once. A direct push can put a broken page live until a fix follows, which costs less than half a minute on every deploy.

## Consequences

- [page.browser.test.ts](../../tests/page.browser.test.ts) and [playwright.config.ts](../../playwright.config.ts).
- [tests.md](../tests.md).
- [check-www.yml](/.github/workflows/check-www.yml), which [www.yml](/.github/workflows/www.yml) does not call, and [checks.md](/.github/docs/checks.md).
