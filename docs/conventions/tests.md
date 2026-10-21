# Tests

These rules are mandatory for implementation and refactoring.

Test required behaviour and compatibility contracts of the game or platform. Keep the smallest test set that protects it. Each test must cover a distinct requirement or failure risk. Seeded fuzz tests are useful when event combinations expose a separate risk. Extend an existing scenario when it already protects that behaviour. Remove duplicate checks and tests of implementation details; do not target line coverage or a test count.

Use unit tests by default. Add in-memory integration tests only when unit tests cannot verify a required interaction. During implementation, run affected fast tests and typechecks. Run the full fast suite in CI and when changing shared contracts.

Run browser tests only for changed behaviour that fast tests cannot establish, such as page lifecycle or real WebRTC connectivity. Choose the affected scenario and run it once the change is ready. Pure game rules, state transitions and test or documentation edits do not by themselves require a browser run.

Keep browser checks outside the default test command. Any browser CI job must run separately, on explicit request or for changes that require browser verification.

Use controlled time for deadlines, including in browser checks. Do not wait through application timeouts. Bound real network waits. Repeat successful checks only after relevant changes or new evidence of a problem. Report what was actually verified.
