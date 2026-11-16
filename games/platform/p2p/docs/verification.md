# Verification

The tests in [src/tests/](../src/tests/) run in Node, as [workspace.md](../../../docs/workspace.md#checks) says. Put a new test of the session in the file for what it checks:

- [Machine tests](../src/tests/session-machine.test.ts): the rules and deadlines of [session.md](session.md). `invariantViolations` runs after every step there and in the fuzz tests.
- [Handover tests](../src/tests/handover.test.ts): snapshot acceptance, with a test for every row of the table in [session.md](session.md#snapshot-acceptance).
- [Room tests](../src/tests/room-state.test.ts): membership and moves.
- [Session tests](../src/tests/session.test.ts): how the session works with its transport, such as delivery, creator restoration and connection failure.
- [Seeded fuzz tests](../src/tests/session-fuzz.test.ts): combinations of events. Keep them: they explore event interleavings and check that sessions converge or close without promoting guests.

Take time in tests from the [controlled clock](../src/tests/clock.ts).
