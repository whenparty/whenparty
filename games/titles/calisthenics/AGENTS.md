# Calisthenics

The [specification](docs/specs/) describes the championship. Use the shared [P2P platform](../../platform/p2p/AGENTS.md) for connections and participant lifecycle.

## Architecture

- [src/core/](src/core/index.ts) is the game's mechanics: rules, championship state and what each screen shows. It holds every rule of the specification that decides state or numbers, such as podium steps (4-6) and repetitions (4-9), including rules that only the 3D interface shows, and the state players share, such as the choices in an athlete's profile. It has no browser, page or three.js code.
- [src/connection.ts](src/connection.ts) connects a page to a room on the P2P platform: it creates and joins rooms, keeps the player across reloads and puts the room code in the address. Within the game it imports only `src/core/`.
- Each folder in `src/frontends/` other than `shared/` is one interface from the specification: `text/` is loaded by `text.html`, `3d/` by `index.html`. Its `main.ts` connects to the room and passes the room state and the player's actions to the elements it shows. Within the game a frontend imports from `src/core/`, `src/connection.ts` and `src/frontends/shared/`, and nothing from another frontend.
- [src/frontends/shared/](src/frontends/shared/) holds texts and page elements that more than one frontend uses. Texts are functions of `src/core/` data. Elements build their own markup inside an element the frontend gives them. Within the game it imports `src/core/` and only types from `src/connection.ts`.
- Wording, default looks and anything else that only changes how the game looks belong to frontends, not to `src/core/`.
- When you add or change a 3D asset, update its attribution in `CREDITS.txt`.

## Verification

[Requirement tests](src/tests/) check `src/core/`, and the platform room functions where a requirement depends on seats and presence. [src/tests/fixtures.ts](src/tests/fixtures.ts) builds championships for them. Run `pnpm --filter @whenparty/calisthenics test` and `pnpm --filter @whenparty/calisthenics typecheck` from `games/`, and `pnpm format` before committing. The test command also checks the architecture's import rules in [.dependency-cruiser.cjs](.dependency-cruiser.cjs). The production `appId` is `when.party/calisthenics`; deployment uses `compose.yml` and `Dockerfile`.

Run `pnpm --filter @whenparty/calisthenics build` to check both entries. Verify scene loading, reduced motion, animation transitions, 12-athlete layout and interface switching in a browser; unit tests do not verify WebGL rendering. Local development uses the signaling server described in [games/AGENTS.md](../../AGENTS.md).
