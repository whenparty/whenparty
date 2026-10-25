# Tests

Test the requirements in the [specification](specs.md) of a project or module and specific failure risks of its implementation. Every requirement needs a test. Requirement tests check the boundaries of each rule with concrete values. Keep the smallest test set that protects them. Name a requirement test file after its specification file, such as `1-match.test.ts` for `1-match.md`. A requirement test checks requirements of one specification file. Its name starts with the full IDs of the requirements it checks, such as `1-3`, not of those it relies on for setup. Name a failure-risk test file after the code it protects; its tests carry no IDs. Seeded fuzz tests are useful when event combinations expose a separate risk. Extend an existing scenario when it already protects that behaviour. Remove duplicate checks and tests that protect neither a requirement nor a specific risk; do not target line coverage or a test count.

Requirement tests verify behaviour through the public interface of the project or module, whichever files implement it. A test of internal code needs a specific risk that requirement tests do not cover. Tests of one specification do not re-verify rules that another specification states. From `games/`, `pnpm --filter @whenparty/calisthenics test --test-name-pattern '\b1-3 '` runs the tests of requirement `1-3`.

Use unit tests by default. Add in-memory integration tests only when unit tests cannot verify a required interaction.

Use controlled time for deadlines. Do not wait through application timeouts. Bound real network waits.
