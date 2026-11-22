# Browser tests

## Context

Some requirements of `games/` hold only in a real browser with real servers: that the browser's data channel takes the largest text of the transport (`3-6` of [3-connection.md](../../platform/transport/docs/specs/3-connection.md)), that pages connect through coturn when they reach each other only through it, and stay connected after their credentials expire (`8-5` and `8-6` of [8-turn.md](../../platform/transport/docs/specs/8-turn.md)), the tab lock of rooms (`9-2` of [9-tab.md](../../platform/rooms/docs/specs/9-tab.md)), and the address, the copy button and the colours of a title's page (`2-3`, `2-7` and `2-14` of tictactoe's [2-page.md](../../titles/tictactoe/docs/specs/2-page.md)). The [testing rules](/docs/conventions/tests.md) run such tests in Playwright, in files that end in `.browser.test.ts`.

- `www/` runs its browser tests in the Playwright image, locally and in CI, as [tests.md](/www/docs/tests.md) says. The image pins the browser, and a CI runner pulls about 2 GB of it on every run. Playwright can instead install its pinned Chromium and the libraries it needs on the runner, also on every run.
- A browser on a Mac does not reach the addresses of a Docker network, and a container on Docker's host network does.
- GitHub's `ubuntu-latest` runner comes with Google Chrome and Docker. Its Chrome is the browser that most players use, and its version changes with the runner image.
- `games/` is one [pnpm workspace](../workspace.md), and its root package holds the tools that every package shares.
- The [signaling deployment](../../platform/signaling/AGENTS.md) starts its servers in Node with `startSignalingServer` of [server.mjs](../../platform/signaling/src/server.mjs), which takes a TURN secret and the server parts, such as the [rooms server](../../platform/rooms/docs/specs/1-room.md). coturn runs in Docker from the [turn deployment](../../platform/turn/AGENTS.md)'s config and start script, as its [smoke test](../../platform/turn/docs/smoke-test.md) does.
- The production servers run what `main` last [deployed](/.github/docs/deploys.md). Their rooms server keeps at most 10 open rooms across all app IDs (`12-1` of [12-server-answers.md](../../platform/rooms/docs/specs/12-server-answers.md)). Their coturn has [quotas](../../platform/turn/docs/deployment.md) that players share, and a browser refreshes its allocations there about every 9 minutes. A page on `localhost` connects to signaling at `localhost` (`1-13` of [1-signaling.md](../../platform/transport/docs/specs/1-signaling.md)).
- The titles run in production as files that Vite built, served by nginx in their images behind the proxy of [infra/](/infra/AGENTS.md), with its headers, such as the Content-Security-Policy of the games, and its limits per client address. Vite's dev server serves the sources and the headers of [dev-headers.ts](../../platform/netcode/src/dev-headers.ts). A build can break a page that works on the dev server, such as by a file name that Vite hashes. The deploy of `main` builds each image once, as [deploys.md](/.github/docs/deploys.md#gamesyml) says. Chrome can map host names to a local address and ignore certificate errors, and the proxy needs Cloudflare's client certificate, which a browser does not have (`1-2` of [1-connections.md](/infra/docs/specs/1-connections.md)). The transport and rooms modules have test pages and no images.

## Options

This decision has five parts.

Whether to test in a browser:

- No browser tests. Nothing to maintain. The requirements above stay untested, and so do the assumptions about Chrome that the fakes of the tests in Node make, such as the size limit of its data channel.
- Browser tests of those requirements, which need a browser and servers.

Where the browser runs in CI:

- In the Playwright image, as `www/` does. The browser is the same locally and in CI, and pinned. Every run pulls about 2 GB.
- Playwright's Chromium, installed on the runner. Pinned and the same as locally, without the image, but every run downloads and installs it.
- On the runner, in its Google Chrome, and locally in the Playwright image. CI downloads neither an image nor a browser, and tests the browser that players use. Chrome's version follows the runner image, and a run on a Mac uses the image's Chromium, which can differ from it.

Where Playwright is set up:

- Once, at the root of the workspace: one version, one config and one command for every package.
- In each package that has browser tests. A package runs only its own tests. Versions can drift apart, and each package repeats the config and the servers.

Which servers the tests use:

- Local servers that the tests start: signaling in Node with a test secret and the rooms server, and coturn in Docker with the deployed config. A test needs no secret of the repository and changes nothing that players use, it tests the code of its own branch, and it can give coturn a short allocation lifetime, so that a test of `8-6` in [8-turn.md](../../platform/transport/docs/specs/8-turn.md) takes seconds. coturn runs on a Docker network instead of the internet.
- The production servers. A test goes the real way, through DNS, nginx and the deployed coturn. It tests what `main` deployed instead of the branch, takes rooms from the 10 that players share, can neither use up coturn's quotas nor shorten its allocation lifetime, and needs pages that are not on `localhost`.

What the tests of the titles run against before a deploy of `main`:

- Only the dev servers, as in a pull request. Nothing more to run. A page that only its build or the proxy breaks deploys.
- The images that the deploy built, with signaling and coturn in their images, behind nginx with the configs of production and certificates of the run, without the client certificate check. The deploy tests what it deploys, through the headers and limits that players get, and needs no secret; it takes about a minute more, runs one test at a time because every page comes from one address, and a failure that only it finds shows on `main`.
- The production site after the deploy. The real way, but it takes rooms from players, as the fourth part says, and finds a broken page only after players got it.

## Decision

Browser tests, set up once at the root of the workspace, with local servers, run locally in the Playwright image, which reaches coturn's network on a Mac too, and in CI in the runner's Chrome. The local servers test the branch in seconds without a secret and without taking from players, which the production servers cannot. The runner's Chrome saves a download on every run, and a difference between Chromium and Chrome shows as a failure in CI. One setup at the root serves every package, as the other shared tools of the workspace do. Before a deploy of `main`, the tests of the titles also run on the images that the deploy built, behind the proxy's configs, because only that tests the built files and the headers that players get, before players get them; the test pages of the modules have no images and stay on the dev servers.

## Consequences

- [browser-tests.md](../browser-tests.md): how the tests start the servers and the browsers.
- [playwright.config.ts](../../playwright.config.ts), [tests/browser.sh](../../tests/browser.sh), [tests/servers.mjs](../../tests/servers.mjs) and [tests/e2e.sh](../../tests/e2e.sh).
- The `images` job of [games.yml](/.github/workflows/games.yml), as [deploys.md](/.github/docs/deploys.md#gamesyml) says.
- The `browser` job of [check-games.yml](/.github/workflows/check-games.yml), as [checks.md](/.github/docs/checks.md) says.
