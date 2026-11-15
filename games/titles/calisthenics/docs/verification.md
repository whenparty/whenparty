# Verification

Run these from `games/`:

- `pnpm --filter @whenparty/calisthenics test` runs the tests in [src/tests/](../src/tests/) in Node and, when they pass, checks the import rules of [architecture.md](architecture.md).
- `pnpm --filter @whenparty/calisthenics typecheck` checks the types of `src/` and `vite.config.ts`.
- `pnpm --filter @whenparty/calisthenics build` builds both entries, `index.html` and `text.html`.
- `pnpm format` formats the code. Run it before committing.

The requirement tests check `src/core/`, the files `appearance.ts`, `presentation.ts`, `exercises.ts` and `athlete-model.ts` of `src/frontends/3d/`, and the platform room functions where a requirement depends on seats and presence. [src/tests/fixtures.ts](../src/tests/fixtures.ts) builds championships for them.

Automated tests do not verify WebGL rendering. Verify scene loading, reduced motion, animation transitions, the layout of 12 athletes and switching between the interfaces in a browser. To run the game locally, start signaling as [games/AGENTS.md](../../../AGENTS.md) says, then run `pnpm --filter @whenparty/calisthenics dev`.
