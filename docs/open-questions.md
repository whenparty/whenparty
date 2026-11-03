# Open questions

## Testing the TURN module

The TURN server in `games/platform/turn/` has no package. Its only test is [smoke.sh](/games/platform/turn/tests/smoke.sh), so the test file and test name rules in [tests.md](/docs/conventions/tests.md) and `pnpm --filter <package> test` do not fit it. Decide this when the TURN server becomes part of the transport module.
