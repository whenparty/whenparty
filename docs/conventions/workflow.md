# Workflow

These rules say how to work on any change. [workflow-specs.md](/docs/conventions/workflow-specs.md) adds how specifications and code change, and [workflow-checks.md](/docs/conventions/workflow-checks.md) says what to check along the way.

## Starting

Before starting work, read the [writing rules](/docs/conventions/writing.md) and the conventions files that cover what the task changes, as the [map](/AGENTS.md) lists them, and follow them.

Read every `AGENTS.md` on the path of the files the task changes, and, following their maps and the maps they link to, the documents the task needs. Keep changes within the requested scope.

Files that git ignores, such as `node_modules` and build output, are not part of the repository. Do not edit them or take them as rules.

Before starting, check [open questions](/docs/open-questions.md) about the projects, modules or topics the task touches and raise them with the user. Add a question only with the user's agreement. When a question is decided, move the decision into the document it concerns, such as a conventions file, a document that an `AGENTS.md` links to, or a specification, and delete the question. The Decisions section below says when the decision also needs a decision record.

## Cutting a task into pieces

Before changing any file, read every outline in `whenparty-notes/outlines/`. The `whenparty-notes` folder lies beside the repository's main working tree, which is the parent of the folder that `git rev-parse --path-format=absolute --git-common-dir` prints. When the folder or its `outlines/` is missing, there are no outlines; when the session may not read the folder, ask the user where the outlines are. When the task overlaps a piece that is not done, tell the user before cutting the task.

Then cut the task into the smallest pieces that each have one purpose, such as one change of a rule or one thing that people or other projects or modules can newly do. Each piece reaches `main` in a pull request of its own and leaves everything that already works on `main` working. Each piece comes after the pieces it relies on. A change of the [conventions files](/AGENTS.md#conventions-files), the [glossary](/docs/glossary.md), a [skill or a subagent](/.claude/AGENTS.md) is a piece of its own. Of the pieces that can go next, take first the smallest one that works end to end, from its user, a person or another project or module, through every project and module it needs; a test may stand in for the user. Split a piece too large to understand at once into smaller pieces that each work end to end, and only when no such split exists, by [project](/docs/glossary.md#project) or [module](/docs/glossary.md#module), starting with the one that the others call.

When there are several pieces, propose an outline and ask the user to approve it as a whole: the pieces in order, one line each on what it adds and what is still missing after it, then what more than one piece relies on, such as a type, a term or a rule. Save the approved outline in `whenparty-notes/outlines/` as a file named after the task, creating the folder when it is missing, and delete it when all its pieces are done or the user cancels the task.

The session that proposed the outline, or one that the user asks to continue it, leads the task; this section calls it the lead. For each piece, the lead starts a new Claude Code session or, when it cannot, gives the user a prompt for one; either gets the path to the outline and the piece's line. A piece does not run in a subagent, which can neither ask the user nor start the reviewers. A piece's session takes its piece as the task and as the change that [workflow-specs.md](/docs/conventions/workflow-specs.md) speaks of, and proposes no outline: when the piece needs splitting or a rule change first, it stops and tells the lead. When the piece's pull request is merged, the lead checks the piece against the outline, tells the user of any difference, marks the piece done and, after reading the rules that the piece changed, starts the next piece from that `main`. The lead changes the outline only with the user's approval, apart from marking a piece done and splitting a piece.

## Decisions

When a task needs a decision the conventions do not cover, such as a new [project](/docs/glossary.md#project) on the [map](/AGENTS.md), a new [module](/docs/glossary.md#module), a new kind of document, a new conventions file or a new package dependency, or when rules contradict each other or make the task impossible, stop and prepare the decision with the [`decide` skill](/.claude/skills/decide/SKILL.md): describe what is missing and propose options. The user decides.

A new package dependency is a package that a change adds to the `dependencies` or `devDependencies` of a `package.json`, other than `@whenparty/*` packages and packages that the user's request names. Claude Code asks to confirm some of these changes, as [configuration.md](/.claude/docs/configuration.md) describes; approving such a prompt is not the user's decision on a new package dependency.

When you see a better way to reach the result than a rule allows, follow the rule anyway. In your report, name the rule, describe the better way and why it is better. The user decides whether to change the rule.

Do not propose again an option that a [decision record](/docs/conventions/decisions.md) has already weighed unless you have facts that the record does not contain. Link the record and name those facts.

The user has the final word, even when it contradicts these rules. When it does, remind the user of the rule, then follow their decision.

After any decision the user makes under this section or on an open question, write a decision record when the decision record rules call for one: tell the user whether they do and why, and have the user approve the text. The record reaches `main` with the first change that follows from it, or on its own when the decision changes nothing. A change that goes against a decision record is a new decision for the user. When the user accepts it, the same change rewrites or deletes the record as the decision record rules describe. A change that moves or renames something linked under the record's Consequences updates the link.
