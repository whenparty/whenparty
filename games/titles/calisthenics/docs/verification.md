# Verification

Run these from `games/`:

- `pnpm --filter @whenparty/calisthenics test` runs the tests in [src/tests/](../src/tests/) in Node, apart from those that end in `.browser.test.ts`, and, when they pass, checks the import rules of [architecture.md](architecture.md).
- `pnpm test:browser titles/calisthenics` runs the tests that end in `.browser.test.ts` in a browser, as [browser-tests.md](../../../docs/browser-tests.md) says.
- `pnpm --filter @whenparty/calisthenics typecheck` checks the types of `src/` and `vite.config.ts`.
- `pnpm --filter @whenparty/calisthenics build` builds both entries, `index.html` and `text.html`.

The requirement tests in Node check `src/core/`, the files `appearance.ts`, `presentation.ts`, `exercises.ts` and `athlete-model.ts` of `src/frontends/3d/`, and the platform room functions where a requirement depends on seats and presence. [src/tests/fixtures.ts](../src/tests/fixtures.ts) builds championships for them. The browser tests in [4-presentation.browser.test.ts](../src/tests/4-presentation.browser.test.ts) check [4-5](specs/4-presentation.md) on the 3D page: that it says 3D is unavailable and links to the text interface for the same room when the browser has no WebGL and when `athlete.glb` fails to load, and that the athlete the page shows while it is in no room stands still while the browser asks for reduced motion and moves when it stops asking.

Check by hand in a browser what the browser tests leave out: the scenes and movements that [4-presentation.md](specs/4-presentation.md) and [5-movements.md](specs/5-movements.md) describe, including the still poses of the announcement, results and podium under reduced motion, the transitions between animations, the layout of 12 athletes ([3-1](specs/3-match.md)) and switching between the interfaces ([4-2](specs/4-presentation.md)). To run the game locally, start signaling as [workspace.md](../../../docs/workspace.md#running-a-title-locally) says, then run `pnpm --filter @whenparty/calisthenics dev`.
