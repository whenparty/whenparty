# Workflow: checks

These rules say what to check while working on a change that [workflow-changes.md](/docs/conventions/workflow-changes.md) describes. Repeat successful checks only after relevant changes or new evidence of a problem. Report what was actually verified.

## Documents

- Before editing any document, read every Markdown file that git tracks or the change adds, including those that look unrelated, and resolve the duplicates and contradictions the edit would create.
- Before proposing the text of a document, give it to a reviewer who has not seen the discussion, such as an agent with a fresh context, together with the files it goes into and links to. The reviewer only suggests changes. Weigh each suggestion and report your conclusions, including the suggestions you rejected.
- When an agent breaks a rule that a document states, first check whether the rule is unclear, stated in several places or in a document that mixes purposes, as the [documentation conventions](/docs/conventions/documentation.md) describe. Fix that before adding emphasis or another rule.
- After adding a document or changing a rule, have a reviewer who has not seen the discussion, such as an agent with a fresh context, read every Markdown file that git tracks or the change adds and report unclear text, contradictions, duplicates, rules in the wrong file and rules that no longer match how the repository works. Fix those places.

## Code

- During implementation, run the affected fast tests and typechecks. Run the full fast suite when changing shared contracts.
- Before reporting a change as done, check each affected requirement against the code and its tests. Affected requirements are those the branch changes in `docs/specs/` since it left `main` and those that the `AGENTS.md` of the changed project or module lists as relying on it.
