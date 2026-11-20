---
name: docs-weekly
description: The weekly pass over the documents of this repository. Counts their words, starts a session for each long document that regroups, cuts or splits it, cuts text that adds nothing, finds why documents grew, proposes lessons for the writing rules and goes over with the user the misunderstandings collected during the week. Use when the weekly scheduled task starts it, when the pass starts a session for one document, or when the user asks for the weekly pass.
---

# Weekly pass over the documents

The [writing rules](/docs/conventions/writing.md) leave splitting documents and regrouping their sections to this pass. The pass runs in one session, the pass session, which starts a document session for each long document; a session whose prompt does not make it a document session is the pass session. The pass session takes the steps below from [Start](#start) to [Report](#report); a document session takes [Start](#start), [Busy files](#busy-files), [Change a document](#change-a-document) and [Report](#report). Each makes a change like any other: it follows the [workflow](/docs/conventions/workflow.md) and [its checks](/docs/conventions/workflow-checks.md), and these steps add what is particular to it. `<notes>` is the `whenparty-notes` folder that [Cutting a task into pieces](/docs/conventions/workflow.md#cutting-a-task-into-pieces) finds. Each run keeps its reports in `<notes>/weekly-docs/<date>/`, where `<date>` is the day the pass session started: the pass session in `pass.md`, and each document session in a file named after the path of its document with each `/` replaced by `-` and a leading `.` dropped, such as `docs-conventions-workflow.md` or `github-docs-checks.md`.

## Start

1. Start in the main checkout, where [docs-weekly-setup.md](/.claude/docs/docs-weekly-setup.md) has the scheduled task start and where the pass session starts the document sessions. When this session started elsewhere, ask the user to start it in the main checkout, and stop. Run `git fetch origin`. When the main checkout is not on `main`, or its `.claude/` differs from `origin/main`, say so in one line, with the command that brings it to `origin/main`, and stop: its settings and hooks apply to the sessions of the pass, as [configuration.md](/.claude/docs/configuration.md) says.
2. In the pass session, read the earlier reports. A question whose answer no report records is pending: remind the user of it, and the work it asks about waits. The session that gets the answer records it in the report that asked. The work that the answer approves continues on the branch that report names: in the session that asked, or, when the pass session gets the answer to a question of a document session, in a document session that it starts for that document, with the answer and the branch after the prompt.
3. Make each change in a new worktree on a new branch from `origin/main` named `docs-weekly/<date>/<report>`, where `<report>` is the name of the session's report without `.md`, or on the branch that the prompt names. When the session stops before the user sees its change, write why and its worktree in its report as a question to the user. When the user declines a change, remove its worktree and branch. Before the merge, when `origin/main` has changed a file that the branch also changes, rebase the branch on `origin/main` and run [check-docs.py](/.github/scripts/check-docs.py) again.

## Count

Count the words of every document, one file at a time, with this command, which skips Mermaid blocks and counts a link by its text:

```sh
LC_ALL=C awk '/^ *```mermaid *$/ { m = 1; k = 0; next } m && /^ *```/ { m = 0; next } m { k += NF; next } { n += NF } END { print n + m * (k + 1) }' <file>
```

List the documents over 1000 words, with their counts now and at the last commit of `origin/main` a week ago.

## Busy files

A file is busy when:

- an open pull request changes it, as `gh pr list --state open --limit 1000 --json number,files` shows;
- a worktree of the main checkout, as `git worktree list` shows, has an uncommitted or untracked change of it;
- or the branch of such a worktree changes it, as `git diff origin/main...<branch> -- <file>` shows, and either has no merged pull request or has commits after the head of its last merged one, as `gh pr list --state merged --head <branch>` shows.

The worktrees, branches and pull requests of one run, on branches named `docs-weekly/<date>/…` with the same date, make no file busy for the sessions of that run. No session of the pass changes a busy file. When an edit would have to change one, such as a link in it that a split moves, drop the edits that need it, record in the report which file was busy, and take the document again in the next run; a dropped edit is not a question to the user.

## Why documents grew

For each document that grew during the week, read the commits that added its words, such as with `git log -p --since='7 days ago' origin/main -- <file>`. Sort the added text into new rules and facts, and text that adds nothing: the kinds in step 2 of [Change a document](#change-a-document), or a rule written in general words and then narrowed by conditions.

Cut that text, as steps 2 and 4 of Change a document say, in each such document that is not busy, is not a specification and that no outline in `<notes>/outlines/` names, unless the user agrees: in the document session of the document when it gets one, and otherwise in the change of the pass session. For a rule of work, as the [Decisions section](/docs/conventions/workflow.md#decisions) lists them, its document session puts the cuts in its plan, and otherwise the pass session asks about them in a question of their own.

When one kind of text that adds nothing comes from at least two pull requests of the week, propose a lesson for the writing rules or the specification rules in one question, with the words it adds and the places it would have shortened. Add it only after the user agrees.

## Parts with another purpose

Read `<notes>/weekly-docs/parts.md`, where sessions note parts of documents that have another purpose or area, as the writing rules say. Move each part that is not in a busy document, as the writing rules say: in the document session of the document that holds it when it gets one, and otherwise in the change of the pass session. When the part comes from or goes to a rule of work, put the move in the plan of its document session or in a question of its own. Ask Codex about every move, as step 4 of Change a document says. The session that moves a part deletes its note.

## Document sessions

Take every document over 1000 words that is not busy and does not wait. A document waits when a pending question asks about it, when the user declined a plan or a change for its present text, or when it is a decision record or a README that a pass has already cut and whose text has not changed since. For each, start a document session in the main checkout, without a worktree of the app, with this prompt followed by the text that adds nothing and the parts that the steps above found in the document:

```text
Run the docs-weekly skill of this repository as the document session for <path> in the run of <date>: read .claude/skills/docs-weekly/SKILL.md and follow it.
```

Start them all at once. Each is a change of its own, not a piece of a task, so the pass session leads none of them and writes no outline for them. When the app does not let the pass session start a session, propose it instead, so that the user starts it.

## Misunderstandings

Read `<notes>/weekly-review/mismatches.md`, where sessions note, as the Decisions section says, the questions and corrections of the user that show that the user and the agent understood something differently. For each entry, find what caused it: a rule, a report or an agent's habit. Propose each change of a rule of work in one question. Propose each lesson about how to work with the user, and save it in the memory as the Decisions section says. Delete each entry once it is settled.

## Report

Report as [Messages to the user and the lead](/docs/conventions/workflow.md#messages-to-the-user-and-the-lead) says, and say for each step whether a script or an agent did it. In `pass.md`, add the documents over 1000 words, the report of the document session of each or that it was only proposed, and those that are busy or wait, with the reason. Before you ask a question, write it in your report with the branch of its work, and record each answer there.

## Change a document

A document session changes its document, and makes the cuts and moves the parts that the pass session gave it. When an outline in `<notes>/outlines/` names the document, ask the user before you change it.

- A specification file. Move requirements that share a topic, with the state tables whose cells cite them and their tests, to a new file, as the reformat in the [specification rules](/docs/conventions/specs.md#content) says: no requirement is shortened or reworded, and a test name keeps its words apart from its IDs unless they no longer fit, such as words that name the old file's topic. Commit the split on its own, apart from the other edits of the change. Run [check-docs.py](/.github/scripts/check-docs.py) and the typechecks and tests, as the [Code checks](/docs/conventions/workflow-checks.md#code) say. Then give the split, with the map from each old file and ID to the new one, to the [`spec-test-verifier` subagent](/.claude/agents/spec-test-verifier.md). Fix what the split caused, in any file that is not busy; when a fix needs a busy file, drop the split, as [Busy files](#busy-files) says. List the verifier's other findings in the report as work for a later task. When a test name changed in more than its IDs, ask Codex with the [`codex` skill](/.claude/skills/codex/SKILL.md), as step 4 below says.
- A decision record or a README. Only cut it, as steps 2 and 4 below say; never regroup or split it.
- A rule of work. Change nothing yet. Send the user a plan in one question: the new documents and the sections in each, what is regrouped, the text that is cut and why, the parts that move, and, for a document that [doc-context.sh](/.claude/hooks/docs/doc-context.md) makes agents read, the change to the hook and its document, to the list in the root `AGENTS.md` of the documents to read before any change, and to [required-reading.md](/docs/decisions/required-reading.md). After the user agrees, change it as any other document.
- Any other document. Change it, then report it.

For a document other than a specification:

1. Regroup its text so that each section has one topic.
2. Cut text that adds nothing: details that no reader acts on, such as how many tokens a measurement took; an introduction that retells the headings or a map; a rule that the document repeats from the document that states it and links; wording longer than its meaning needs. Keep every rule, condition and fact that a reader acts on, such as "Weigh the options and choose the best", and every reason that a decision record gives for its decision. Before you cut a sentence that states a rule, find where the rule is still stated. A rule that looks needless now that models follow it unasked, such as not editing files that git ignores, stays: propose to the user to remove it, with the reason.
3. When the document stays over 1000 words, as the command in [Count](#count) counts them, split it by topics into documents named as the writing rules say, and update every link to the parts that moved. Run check-docs.py.
4. Ask Codex whether a rule, condition, fact or term of the old text is lost or changed in the new one. Give it both texts and the links that moved. Fix what holds.
