# Calisthenics

The [specification](docs/specs/) describes the championship. Use the shared [P2P platform](../../platform/p2p/AGENTS.md) for connections and participant lifecycle.

## Architecture

The game is built to have several interfaces over one engine, such as the current text interface and a later 3D one.

- [src/engine/](src/engine/index.ts) owns the rules, the championship the host runs and what each screen shows. It has no page code, so every interface renders the same state and results. State that players choose and others see, such as the athlete's profile, belongs in the engine.
- [src/room.ts](src/room.ts) joins, keeps and leaves a room in the browser for any interface.
- Each interface has its own folder under `src/` and imports nothing from another interface. [src/text/](src/text/main.ts) is the text interface, loaded by `index.html`. Display names of characteristics, other wording and presentation belong to the interface.

## Verification

[Requirement tests](src/tests/) check the engine, and the platform room functions where a requirement depends on seats and presence. [src/tests/championship.ts](src/tests/championship.ts) builds championships for them. Run `pnpm --filter @whenparty/calisthenics test` and `pnpm --filter @whenparty/calisthenics typecheck` from `games/`, and `pnpm format` before committing. The production `appId` is `when.party/calisthenics`; deployment uses `compose.yml` and `Dockerfile`.
