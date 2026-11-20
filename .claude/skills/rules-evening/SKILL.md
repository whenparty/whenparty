---
name: rules-evening
description: The evening change of the rules of work of this repository. Takes the entries of the rules queue in whenparty-notes/rules-queue/ into one change, has it checked and brings it to the user. Use when the evening scheduled task starts it, or when the user asks for the evening change of the rules.
---

# Evening change of the rules

During the day, changes of the rules of work wait in the rules queue, as [Rule changes](/docs/conventions/workflow.md#rule-changes) says. This skill brings them to `main` in one change, which follows the [workflow](/docs/conventions/workflow.md) and [its checks](/docs/conventions/workflow-checks.md) like any other; these steps add what is particular to it. `<notes>` is the `whenparty-notes` folder that [Cutting a task into pieces](/docs/conventions/workflow.md#cutting-a-task-into-pieces) finds, and [rules-evening-setup.md](/.claude/docs/rules-evening-setup.md) says how the scheduled task starts this skill.

1. Start in the main checkout. Run `git fetch origin`. When the main checkout is not on `main`, or its `.claude/` differs from `origin/main`, say so in one line, with the command that brings it to `origin/main`, and stop: its subagents, settings and hooks apply to this session, as [configuration.md](/.claude/docs/configuration.md) says.
2. List the files in `<notes>/rules-queue/`. An entry that names the branch of an earlier run that is not merged belongs to that run's change: remind the user of that change and leave the entry out. When no other entry is left, say so in one line and stop. The change takes only the entries listed now; an entry written later waits for the next evening.
3. Work in a new worktree on a new branch from `origin/main` named `rules-evening/<date>`, and write that branch's name at the end of each entry that the change takes.
4. Write the change of every entry, from its agreed points and its draft, with the edits of the documents that must follow it. The agreed points of the entries are the agreed points of the change.
5. Check the change as [Documents](/docs/conventions/workflow-checks.md#documents) and [Last reading](/docs/conventions/workflow-checks.md#last-reading) say, with the entries as its sources.
6. Report as [Messages to the user and the lead](/docs/conventions/workflow.md#messages-to-the-user-and-the-lead) says, with one item for each entry. Take the edits of an entry that the user declines out of the change, as Last reading says for a correction of the user, and delete the entry. Commit, push, open the pull request and merge as [Pull requests](/docs/conventions/workflow.md#pull-requests) says, with the reasons of the entries in the commit message and the pull request description. Then delete the entries that the change took, and, when the main checkout is on `main` with no changes, run `git pull --ff-only` in it.
