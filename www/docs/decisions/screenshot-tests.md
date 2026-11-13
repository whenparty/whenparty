# Screenshot tests

## Context

`www/` is one static page without components or a specification, and most of what it does is animation: balloons inflate, bob and take off, their strings meet ropes, and the page fades. A mistake, such as a string that points at the rope while its balloon flies away, shows at once to a person who watches.

A browser test can measure each part at a set time of an animation, or take a screenshot. Playwright compares a screenshot with an approved one within a tolerance and, when they differ, leaves both and their difference. Browsers draw a few pixels differently on another operating system or processor: Docker on an Apple Silicon Mac runs arm64, and GitHub's runners x86. A pull request shows the old and new image side by side. Git LFS keeps files outside the repository, and every checkout of them counts towards a transfer quota. A workflow run by hand must be on `main`, while one that a label on a pull request starts runs from its branch. A commit that a workflow makes with its own token starts no other workflow.

As [ci-checks.md](/docs/decisions/ci-checks.md) decides, `ci.yml` checks every pull request and push to `main`, and only `games.yml` and `infra.yml` wait for their checks. No ruleset on `main` requires a pull request or a passing check, as [main-branch-protection.md](/docs/decisions/main-branch-protection.md) decides. The site deploys in about 1.5 minutes, and the browser tests take 1 to 2 in CI.

## Options

This decision has four parts.

How the animations are checked:

- No browser tests, the previous setup. Nothing to maintain. A mistake shows only to someone who watches the takeoff.
- Assertions on the position and size of each part at set times. A failure names what moved, and pixels do not matter. Every part and moment needs an assertion, and an unforeseen mistake passes.
- Screenshots of a storyboard: a sheet of frames at set times. Any visible change fails, and a person approves the sheet by looking at it. The pixels depend on where the browser runs, and every intended change needs new screenshots.
- Storybook stories that Chromatic compares in its cloud, with a review page. Pixels do not depend on the local machine. The page would be cut into stories, its click, timer and reduced motion still need a browser test, and it costs a large dependency, an account, a CI secret and a monthly screenshot limit.

Where the approved screenshots live:

- PNG files in git next to the test. A pull request shows them. The repository grows by a few hundred kilobytes with each update.
- Git LFS. The repository stays small. It needs setup, CI checkouts with LFS, and the transfer quota.
- Their hashes in git. The smallest. A hash allows no tolerance, so one pixel fails the test, and a failure has no approved image to compare with.

Where the approved screenshots are made:

- Locally, in the same Docker image. No workflow with write access. On an Apple Silicon Mac they differ from what CI draws.
- In CI, by a workflow run by hand on the branch. The same kind of machine as the check. It needs its file on `main` and write access, and its commit needs another push to be checked.
- In CI, by a workflow that a label on the pull request starts. The same, but it runs from the branch, and the label must exist.

Whether the deploy waits for the tests:

- `www.yml` calls the check before it deploys. A failing test stops the page from going live. Every deploy takes 1 to 2 minutes longer.
- The deploy does not wait. CI still tests every change to `www/`. A direct push that fails the tests is already live.

## Decision

Storyboards of the takeoff at a desktop and a phone width, compared with PNG files in git that a workflow in CI makes when a label asks for it, and a few tests without screenshots, such as when the link opens. Approving a sheet of frames by eye costs less than an assertion for every part, and it catches mistakes nobody foresaw. The page has no components for stories. A few hundred kilobytes per update do not justify Git LFS, and hashes would hide the difference that makes a failure useful. Screenshots from the machine type of the check keep a local Mac out of the approved images, and a label works on every pull request from a branch of this repository, even one that changes the workflow.

The deploy does not wait for the tests. CI tests pull requests before they merge, and a quick change to the page stays quick.

## Consequences

- [page.test.ts](../../tests/page.test.ts) and [playwright.config.ts](../../playwright.config.ts).
- [tests.md](../tests.md).
- [check-www.yml](/.github/workflows/check-www.yml), [www-snapshots.yml](/.github/workflows/www-snapshots.yml) and [checks.md](/.github/docs/checks.md).
