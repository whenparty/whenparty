# Calisthenics

The [specification](docs/specs/) describes the championship. Use the shared [P2P platform](../../platform/p2p/AGENTS.md) for connections and participant lifecycle.

## Architecture

The text and 3D interfaces use one engine.

- [src/engine/](src/engine/index.ts) owns the rules, the championship the host runs and what each screen shows. It has no page code, so every interface renders the same state and results. State that players choose and others see, such as the athlete's profile, belongs in the engine.
- [src/room.ts](src/room.ts) joins, keeps and leaves a room in the browser for any interface.
- Each interface has its own folder under `src/` and imports nothing from another interface. [src/3d/](src/3d/main.ts) is loaded by `index.html`; [src/text/](src/text/main.ts) is loaded by `text.html`. [src/controls.ts](src/controls.ts) supplies their shared page controls. Display names of characteristics, other wording and presentation belong to the interfaces and their shared controls.
- The 3D character and its animation clips are in `public/assets/`; retain their attribution in `CREDITS.txt`. Appearance, the performance queue and its deadlines are shared engine state. Scene playback follows the current turn and the room clock. Replay stays local to the interface.

## Verification

[Requirement tests](src/tests/) check the engine, and the platform room functions where a requirement depends on seats and presence. [src/tests/championship.ts](src/tests/championship.ts) builds championships for them. Run `pnpm --filter @whenparty/calisthenics test` and `pnpm --filter @whenparty/calisthenics typecheck` from `games/`, and `pnpm format` before committing. The production `appId` is `when.party/calisthenics`; deployment uses `compose.yml` and `Dockerfile`.

Run `pnpm --filter @whenparty/calisthenics build` to check both entries. Verify scene loading, reduced motion, animation transitions, 12-athlete layout and interface switching in a browser; unit tests do not verify WebGL rendering. Local development uses the signaling server described in [games/AGENTS.md](../../AGENTS.md).
