# P2P

Read [STATES.md](STATES.md) for session rules. [src/room-state.ts](src/room-state.ts) defines the game interface; [src/handover.ts](src/handover.ts) decides which snapshots a tab takes; [src/protocol.ts](src/protocol.ts) validates messages.

Keep rules and transitions pure. [src/session-machine.ts](src/session-machine.ts) decides transitions; [src/session.ts](src/session.ts) runs effects. The creator keeps the host role. Player identity survives reloads; a connection identifies one tab. Only the controlling connection can act for a player. Games decide whether availability permits play.

Use [machine tests](src/tests/session-machine.test.ts) for rules and deadlines, [handover tests](src/tests/handover.test.ts) for snapshot acceptance, and [room tests](src/tests/room-state.test.ts) for membership and moves. Run `pnpm format` before committing. [Session tests](src/tests/session.test.ts) verify transport interactions. Keep the [seeded fuzz test](src/tests/session-fuzz.test.ts) for event combinations. Use the [controlled clock](src/tests/clock.ts) and test real WebRTC with separate browser profiles or origins.

Keep `src/dev-headers.ts` aligned with `infra/nginx/conf.d/`. Follow [signaling instructions](../signaling/AGENTS.md) for Trystero updates and [TURN instructions](../turn/AGENTS.md) for relay configuration.
