# Open questions

## Browser tests

The [testing rules](/docs/conventions/tests.md) say how browser tests are written and named, but `games/` has none yet. Decide, when the first requirement of `games/` that needs a browser test is implemented, which signaling and TURN servers its browser tests use.

## Component screenshots in games

The interfaces of the games may grow into components with many states. Storybook shows each component in its states on its own, and Chromatic, a service of its makers, compares their screenshots in its cloud, with a review page and a check on pull requests. They cost a large dependency, an account, a secret in CI and a monthly limit of screenshots, and a click or a timer still needs a browser test. `www/` compares storyboards in Playwright instead, as [screenshot-tests.md](/www/docs/decisions/screenshot-tests.md) decides for its one static page.

Decide, when a game's interface has components whose states need screenshot tests, whether to use Storybook with Chromatic or Playwright tests like those of `www/`.

## Testing the TURN module

The TURN server in `games/platform/turn/` has no package. Its only test is [smoke.sh](/games/platform/turn/tests/smoke.sh), so the test file and test name rules in [tests.md](/docs/conventions/tests.md) and `pnpm --filter <package> test` do not fit it. Decide this when the TURN server becomes part of the transport module.
