# Open questions

## Browser tests

Some requirements cannot be verified by unit or in-memory integration tests, for example that two browsers whose networks block direct connections still connect through the TURN relay. The repository has no automated browser tests. The [testing rules](conventions/tests.md) name a requirement test file after its specification file, such as `1-connection.test.ts`, and `node --test` runs every `*.test.ts` file, so a browser test named this way would run in the default test command.

Decide when the first requirement that needs a browser test appears: the tool, where browser test files live and how they are named so that the default test command does not run them, and which signaling and TURN servers they use.

## Platform specification

The platform in `games/platform/` needs a [specification](/docs/conventions/specs.md) of what games and players get from it, such as a connection through the TURN relay, and each of its [modules](/docs/glossary.md#module) needs one of its own boundary, as [games/AGENTS.md](/games/AGENTS.md) and the specification rules state. Decide when writing the platform specification:

- where the platform's specification, `AGENTS.md` and `docs/PLANNED.md` live;
- how the platform and the TURN module are tested, together with [Browser tests](/docs/open-questions.md#browser-tests) and [Testing the TURN module](/docs/open-questions.md#testing-the-turn-module);
- where the session rules in [STATES.md](/games/platform/p2p/STATES.md) of p2p move.

## Package-specific commands in the testing rules

[tests.md](conventions/tests.md) shows how to run the tests of one requirement with a command for `@whenparty/calisthenics`. Decide whether package-specific commands belong in the testing rules or in the `AGENTS.md` of the package's own project or module, or of `games/`.

## Fast tests and shared contracts

The [workflow checks](/docs/conventions/workflow-checks.md) say "affected fast tests", "full fast suite" and "shared contracts". None of these terms is defined, and the repository has no slow tests to tell fast ones apart from. Decide whether to define them in the [glossary](glossary.md) or rephrase the checks.

## Rules that code cannot express

[code.md](conventions/code.md) says to put rules that code cannot express in "the module's documentation". It does not say whether that is the specification or the `AGENTS.md`, while the [specification rules](conventions/specs.md) leave implementation choices out of the specification.

## Link to open questions in the documentation conventions

[documentation.md](conventions/documentation.md) ends with a line that links to this file but states no rule. Decide whether to keep it.

## Testing the TURN module

`games/platform/turn` is a module without a package. Its only test is [smoke.sh](../games/platform/turn/tests/smoke.sh), so the test file and test name rules in [tests.md](conventions/tests.md) and `pnpm --filter <package> test` do not fit it. Decide when writing the specification of the TURN module.
