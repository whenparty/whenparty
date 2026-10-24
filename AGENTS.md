# Working in WhenParty

Before starting work, read the [documentation conventions](docs/conventions/documentation.md) and the [convention files](docs/conventions/index.md) that cover what the task changes, and follow them.
Read the applicable `AGENTS.md` files for the area being changed. Keep changes within the requested scope.
Files that git ignores, such as `node_modules` and build output, are not part of the project. Do not edit them or take them as project rules.
Before starting, check [open questions](docs/open-questions.md) about the modules or topics the task touches and raise them with the user. Add a question only with the user's agreement. When a question is decided, move the decision into the conventions or a specification and delete the question.

When a task needs a decision the conventions do not cover, such as a new module, a new top-level folder or a new kind of document, or when rules contradict each other or make the task impossible, stop. Describe what is missing and propose options. The user decides.
When you see a better way to reach the result than a rule allows, follow the rule anyway. In your report, name the rule, describe the better way and why it is better. The user decides whether to change the rule.
The user has the final word, even when it contradicts these rules. When it does, remind the user of the rule, then follow their decision.

## Changes

- Before editing any document, read every Markdown file that git tracks, including those that look unrelated, and resolve the duplicates and contradictions the edit would create.
- When an agent breaks a rule that a document states, first check whether the rule is unclear, stated in several places or in a document that mixes purposes, as the [documentation conventions](docs/conventions/documentation.md) describe. Fix that before adding emphasis or another rule.
- Every code change follows the [testing rules](docs/conventions/tests.md). First decide whether it changes observable behaviour. If it does, it starts with a specification edit, as described below. If it does not, as with refactoring or a fix that matches an existing requirement, the specification stays as it is.
- If the task changes code that belongs to no [module](docs/glossary.md#module) with a [specification](docs/conventions/specs.md), stop. Say that these rules expect one, and ask whether to set it up first or to work without it.
- A behaviour change starts with a specification edit that the user approves before implementation. Claude Code asks for confirmation before editing specification files, as set in [settings](.claude/settings.json).
- The specification edit and the code land in the same pull request, so the requirements a branch has not yet implemented are its `docs/specs/` diff against `main`. Work split over several pull requests adds to the specification only the part each one implements.
- A pull request that adds, changes or removes a reliance on another module's requirement updates the specification and that module's list of relying requirements together.
- When a test would have to check requirements of several specification files, a requirement about how they fit together is missing. Propose it to the user.
- During implementation, change the specification only as approved. When a requirement turns out wrong or incomplete, stop and ask.
- Before reporting a change as done, check each affected requirement against the code and its tests. Affected requirements are those the specification diff changes and those that the changed module's `AGENTS.md` lists as relying on it.

## Checks

- During implementation, run the affected fast tests and typechecks. Run the full fast suite when changing shared contracts.
- Repeat successful checks only after relevant changes or new evidence of a problem. Report what was actually verified.
- After adding a document or changing a rule, have a reviewer who has not seen the discussion, such as an agent with a fresh context, read every Markdown file that git tracks and report unclear text, contradictions, duplicates, rules in the wrong file and rules that no longer match how the project works. Fix those places.
