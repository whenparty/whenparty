# Browser tests

`pnpm test:browser` from `games/` runs every `*.browser.test.ts` of `games/` with [playwright.config.ts](../playwright.config.ts). Its arguments go to `playwright test`, such as the folders of the packages to test, `pnpm test:browser platform/transport`, or a requirement, `pnpm test:browser -g '8-5 '`. It needs Docker. [browser-tests.md](decisions/browser-tests.md) explains why the tests use these browsers and servers.

## Servers

- [tests/browser.sh](../tests/browser.sh) starts coturn in Docker with the [turnserver.conf](../platform/turn/turnserver.conf) and [start.sh](../platform/turn/start.sh) of the deployment, as `smoke.sh` does, at `11.11.11.10` on an internal Docker network whose addresses no denied range of coturn covers. It adds `max-allocate-lifetime` to the config, so that Chrome refreshes its allocations within seconds: Chrome refreshes an allocation after half its lifetime when the lifetime is under 2 minutes. The test of [8-6](../platform/transport/docs/specs/8-turn.md) needs a refresh after the credentials expired.
- [tests/servers.mjs](../tests/servers.mjs), the global setup of Playwright, starts in Node:
  - signaling with the rooms server at `localhost:8080`, where pages on `localhost` connect ([1-13](../platform/transport/docs/specs/1-signaling.md)), without a TURN secret, so that no page asks coturn at `turn.when.party`;
  - signaling with coturn's test secret at `localhost:8081`;
  - Vite with the test pages of the modules, from `games/`, at `localhost:5173`, and tictactoe with its own config at `localhost:5174/tictactoe/`. Neither watches files, so an edit during a run reloads no page under test.

## Browsers

- Locally, `browser.sh` runs Playwright in the Playwright image of the `@playwright/test` version in `package.json`, in its Chromium. The container installs the workspace with the host's `node_modules` hidden, so the host keeps its own, and keeps pnpm's store in the Docker volume `games-browser-tests-pnpm`. It uses Docker's host network, which reaches coturn's network as the CI runner does; that holds on Linux and with Docker on a Mac, where the Mac itself does not reach it. The servers take the ports 8080, 8081, 5173 and 5174 of that network, so a signaling or Vite server started for local play makes the run fail.
- In CI, where `CI` is set, `browser.sh` runs Playwright on the runner, in its Google Chrome, and the workflow installs the workspace before it.
- Chrome starts with `WebRtcHideLocalIpsWithMdns` off, so candidates carry addresses instead of mDNS names.

## Test pages

- The test page of transport, in `platform/transport/src/tests/`, connects to `localhost:8081` and gives its peer connections coturn's address in place of `turn.when.party`. A test can make it relay-only, give it no TURN servers, or give it other credentials. It can also hold allocations under one username, on peer connections of the browser that connect to nothing, until the `user-quota` of [turnserver.conf](../platform/turn/turnserver.conf) makes coturn refuse one. The test of [3-9](../platform/transport/docs/specs/3-connection.md) does this before its call, so that coturn has no free allocation for the caller. Its tests give the pages camera and microphone permission: without it, Chrome offers candidates only on the interface of the default route, whose address coturn denies, and with it, also on the bridge to coturn's network.
- The test page of rooms, in `platform/rooms/src/tests/`, uses the browser environment of rooms, so it connects to `localhost:8080`.
- The tests of tictactoe open its page. Like them, give each player of a test a browser context of its own, because the pages of one context share the tab lock ([9-1](../platform/rooms/docs/specs/9-tab.md)).
- Like the fixtures of rooms and tictactoe, make a test that opens rooms leave them when it ends, also when it fails, and wait until its pages have closed their signaling connections: the rooms server of a run keeps at most 10 open rooms ([12-1](../platform/rooms/docs/specs/12-server-answers.md)), and a room that its owner's page did not leave stays open for minutes.

A failed run leaves its results in `test-results/`, and in CI also the HTML report in `playwright-report/`; CI uploads both, as [checks.md](/.github/docs/checks.md) says.
