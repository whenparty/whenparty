# Open questions

## Browser tests

Some requirements cannot be verified by unit or in-memory integration tests, for example that two browsers whose networks block direct connections still connect through the TURN relay. The repository has no automated browser tests. The [testing rules](/docs/conventions/tests.md) name a requirement test file after its specification file, such as `1-connection.test.ts`, and `node --test` runs every `*.test.ts` file, so a browser test named this way would run in the default test command.

Decide when the first requirement that needs a browser test appears: the tool, where browser test files live and how they are named so that the default test command does not run them, and which signaling and TURN servers they use.

## Platform specification

The platform in `games/platform/` needs a [specification](/docs/conventions/specs.md) of what games and players get from it, such as a connection through the TURN relay, and each of its [modules](/docs/glossary.md#module) needs one of its own boundary, as [games/AGENTS.md](/games/AGENTS.md) and the specification rules state. Decide when writing the platform specification:

- where the platform's specification, `AGENTS.md`, `docs/PLANNED.md` and [decision records](/docs/conventions/decisions.md) live, including those about its modules;
- how the platform and the TURN module are tested, together with [Browser tests](#browser-tests) and [Testing the TURN module](#testing-the-turn-module);
- where the session rules in [STATES.md](/games/platform/p2p/STATES.md) of p2p move.

## Package-specific commands in the testing rules

[tests.md](/docs/conventions/tests.md) shows how to run the tests of one requirement with a command for `@whenparty/calisthenics`. Decide whether package-specific commands belong in the testing rules or in the `AGENTS.md` of the package's own project or module, or of `games/`.

## Fast tests and shared contracts

The [workflow checks](/docs/conventions/workflow-checks.md) say "affected fast tests", "full fast suite" and "shared contracts". None of these terms is defined, and the repository has no slow tests to tell fast ones apart from. Decide whether to define them in the [glossary](/docs/glossary.md) or rephrase the checks.

## Testing the TURN module

`games/platform/turn` is a module without a package. Its only test is [smoke.sh](/games/platform/turn/tests/smoke.sh), so the test file and test name rules in [tests.md](/docs/conventions/tests.md) and `pnpm --filter <package> test` do not fit it. Decide when writing the specification of the TURN module.
