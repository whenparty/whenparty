# Open questions

## Browser tests

Some requirements cannot be verified by unit or in-memory integration tests, for example that two browsers whose networks block direct connections still connect through the TURN relay. The repository has no automated browser tests. The [testing rules](conventions/tests.md) name a requirement test file after its specification file, such as `1-connection.test.ts`, and `node --test` runs every `*.test.ts` file, so a browser test named this way would run in the default test command.

Decide when the first requirement that needs a browser test appears: the tool, where browser test files live and how they are named so that the default test command does not run them, and which signaling and TURN servers they use.

## Requirements shared by platform modules

Behaviour that players see can depend on several modules. For example, a connection through the TURN relay needs [p2p](../games/platform/p2p/AGENTS.md) to fetch TURN credentials from [signaling](../games/platform/signaling/AGENTS.md) and pass them to its connection, and [turn](../games/platform/turn/AGENTS.md) to relay the traffic. Its [smoke test](../games/platform/turn/tests/smoke.sh) already checks two relayed clients.

Decide when writing the specifications of the platform modules which module states which part, so that a module's tests do not re-verify rules another module owns.

## Package-specific commands in the testing rules

[tests.md](conventions/tests.md) shows how to run the tests of one requirement with a command for `@whenparty/tictactoe`. Decide whether package-specific commands belong in the testing rules or in the `AGENTS.md` of the module or of `games/`.

## Fast tests and shared contracts

The [workflow checks](/docs/conventions/workflow-checks.md) say "affected fast tests", "full fast suite" and "shared contracts". None of these terms is defined, and the repository has no slow tests to tell fast ones apart from. Decide whether to define them in the [glossary](glossary.md) or rephrase the checks.

## Rules that code cannot express

[code.md](conventions/code.md) says to put rules that code cannot express in "the module's documentation". It does not say whether that is the specification or the module's `AGENTS.md`, while the [specification rules](conventions/specs.md) leave implementation choices out of the specification.

## Rules for non-module AGENTS.md files

The map in the root [AGENTS.md](/AGENTS.md) gives the root `AGENTS.md`, `games/AGENTS.md` and `games/titles/AGENTS.md` to the [documentation conventions](/docs/conventions/documentation.md), but those conventions do not say what such a file holds. Module `AGENTS.md` files also hold testing, formatting and deployment instructions, not only what the specification rules describe.

## Link to open questions in the documentation conventions

[documentation.md](conventions/documentation.md) ends with a line that links to this file but states no rule. Decide whether to keep it.

## Rules outside games

`www/`, `nii-au/`, `infra/` and `temp-sites/` are not [modules](glossary.md#module), so the [workflow rules](/docs/conventions/workflow-changes.md) stop before any code change there and ask whether to set up a specification. Decide whether and how the specification and testing rules extend to the rest of the repository.

## Testing the TURN module

`games/platform/turn` is a module without a package. Its only test is [smoke.sh](../games/platform/turn/tests/smoke.sh), so the test file and test name rules in [tests.md](conventions/tests.md) and `pnpm --filter <package> test` do not fit it. Decide when writing the specification of the TURN module.
