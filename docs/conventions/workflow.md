# Workflow

These rules say how to work on any change. [workflow-specs.md](/docs/conventions/workflow-specs.md) adds how specifications and code change, and [workflow-checks.md](/docs/conventions/workflow-checks.md) says what to check along the way.

## Starting

Before starting work, read the [writing rules](/docs/conventions/writing.md) and the conventions files that cover what the task changes, as the [map](/AGENTS.md) lists them, and follow them.
Read the applicable `AGENTS.md` files for the area being changed. Keep changes within the requested scope.
Files that git ignores, such as `node_modules` and build output, are not part of the repository. Do not edit them or take them as rules.
Before starting, check [open questions](/docs/open-questions.md) about the projects, modules or topics the task touches and raise them with the user. Add a question only with the user's agreement. When a question is decided, move the decision into the document it concerns, such as a conventions file, an `AGENTS.md` or a specification, and delete the question. The Decisions section below says when the decision also needs a decision record.

## Decisions

When a task needs a decision the conventions do not cover, such as a new [project](/docs/glossary.md#project) on the [map](/AGENTS.md), a new [module](/docs/glossary.md#module), a new kind of document, a new conventions file or a new package dependency, or when rules contradict each other or make the task impossible, stop and prepare the decision with the [`decide` skill](/.claude/skills/decide/SKILL.md): describe what is missing and propose options. The user decides.
A new package dependency is a package that a change adds to the `dependencies` or `devDependencies` of a `package.json`, other than `@whenparty/*` packages and packages that the user's request names.
Put new text in the document where it belongs, even when that takes the document over the word limit of the [writing rules](/docs/conventions/writing.md). Then check the limit. When a document is over it, propose to the user how to bring it under the limit, and make the change after the user approves it. Consider these in order and stop at the first that brings it under: regroup its text so that each section has one topic, which shows the parts that belong elsewhere; move those parts to the documents they belong to; split what remains, as the writing rules describe; and only then shorten the wording, keeping every rule, fact and condition the text states. For a specification file, only the reformat that the [specification rules](/docs/conventions/specs.md) describe applies.
When you see a better way to reach the result than a rule allows, follow the rule anyway. In your report, name the rule, describe the better way and why it is better. The user decides whether to change the rule.
Do not propose again an option that a [decision record](/docs/conventions/decisions.md) has already weighed unless you have facts that the record does not contain. Link the record and name those facts.
The user has the final word, even when it contradicts these rules. When it does, remind the user of the rule, then follow their decision.
After any decision the user makes under this section or on an open question, write a decision record when the decision record rules call for one, and have the user approve its text. The record reaches `main` with the first change that follows from it, or on its own when the decision changes nothing. A change that goes against a decision record is a new decision for the user. When the user accepts it, the same change rewrites or deletes the record as the decision record rules describe. A change that moves or renames something linked under the record's Consequences updates the link.
