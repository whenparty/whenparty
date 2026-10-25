# Workflow: changes

These rules say how to work on any change. [workflow-checks.md](/docs/conventions/workflow-checks.md) says what to check along the way.

## Starting

Before starting work, read the [documentation conventions](/docs/conventions/documentation.md) and the conventions files that cover what the task changes, as the [map](/AGENTS.md) lists them, and follow them.
Read the applicable `AGENTS.md` files for the area being changed. Keep changes within the requested scope.
Files that git ignores, such as `node_modules` and build output, are not part of the repository. Do not edit them or take them as rules.
Before starting, check [open questions](/docs/open-questions.md) about the projects, modules or topics the task touches and raise them with the user. Add a question only with the user's agreement. When a question is decided, move the decision into the conventions or a specification and delete the question.

## Decisions

When a task needs a decision the conventions do not cover, such as a new top-level project, a new module or a new kind of document, or when rules contradict each other or make the task impossible, stop. Describe what is missing and propose options. The user decides.
When you see a better way to reach the result than a rule allows, follow the rule anyway. In your report, name the rule, describe the better way and why it is better. The user decides whether to change the rule.
The user has the final word, even when it contradicts these rules. When it does, remind the user of the rule, then follow their decision.

## Specifications and code

- In a project or module with a specification, every code change follows the [testing rules](/docs/conventions/tests.md). First decide whether the change alters the behaviour the specification describes. If it does, it starts with a specification edit, as described below. If it does not, as with refactoring or a fix that matches an existing requirement, the specification stays as it is.
- If the task changes code of a [project](/docs/glossary.md#project) or [module](/docs/glossary.md#module) that needs a [specification](/docs/conventions/specs.md) and has none, stop. Say that these rules expect one, and ask whether to set it up first or to work without it.
- A behaviour change starts with a specification edit that the user approves before implementation. Claude Code asks for confirmation before editing specification files, as set in [settings](/.claude/settings.json).
- The specification edit and the code reach `main` together, in one pull request or one direct push, from a branch in both cases. Work that reaches `main` in several parts adds to the specification only the part each part implements.
- A change that adds, changes or removes a reliance on a requirement of another project or module updates the specification and that project's or module's list of relying requirements together.
- When a test would have to check requirements of several specification files, a requirement about how they fit together is missing. Propose it to the user.
- During implementation, change the specification only as approved. When a requirement turns out wrong or incomplete, stop and ask.
