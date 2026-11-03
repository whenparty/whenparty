# Workflow: checks

These rules say what to check while working on a change that the workflow files, [workflow.md](/docs/conventions/workflow.md) and [workflow-specs.md](/docs/conventions/workflow-specs.md), describe. Repeat successful checks only after relevant changes or new evidence of a problem. Report what was actually verified.

## Documents

- Before editing a document, besides what the [workflow](/docs/conventions/workflow.md#starting) says to read, search with `git grep -i --untracked` for the names, terms and paths that the old and the new text use, including what the edit removes, and read every document that has a match. Resolve the duplicates and contradictions the edit would create.
- Before proposing the text of a document, give it to a reviewer who has not seen the discussion, such as the [`reviewer` subagent](/.claude/agents/reviewer.md), together with the files it goes into and links to. The reviewer only suggests changes. Weigh each suggestion and report your conclusions, including the suggestions you rejected.
- When an agent breaks a rule that a document states, first check whether the rule is unclear, stated in several places or in a document that mixes purposes, as the [writing rules](/docs/conventions/writing.md) describe. Fix that before adding emphasis or another rule.
- After adding a document or changing a rule, have a reviewer who has not seen the discussion, such as the `reviewer` subagent, read every Markdown file that git tracks or the change adds and report unclear text, contradictions, duplicates, rules in the wrong file and rules that no longer match how the repository works. Fix those places.

## Code

- During implementation, run the typechecks, unit tests and non-browser [integration tests](/docs/glossary.md#integration-test) of the packages the change touches.
- Before reporting a change as done, run them also for the packages that depend on those, and run the browser integration tests of the affected requirements, as the next bullet defines them. The documents on how to work in the project that holds the packages give the commands, and [checks.md](/.github/docs/checks.md) says which browser integration tests CI runs.
- Before reporting a change as done, check each affected requirement against the code and its tests. Affected requirements are those the branch changes in `docs/specs/` since it left `main`, those that link to a specification file the branch changes, and those of other specifications that link to a file of the innermost project or module that contains a changed file. `git grep -i --untracked` in `*/docs/specs/*` finds them by the name of each changed specification file and of each such project's or module's folder; keep the matches whose link leads there.
