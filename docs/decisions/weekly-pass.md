# Weekly pass over the documents

## Context

Until 2026-11-17 the writing rules limited a [document](/docs/glossary.md#document) other than a skill or subagent to 800 words: after an edit that went over, a hook asked the agent to propose a split, and a CI job failed the change. The rule files sat at the limit, so each new rule pulled a split of its file. Without the limit, `workflow.md` grew from 516 to 2082 words and `workflow-checks.md` from 535 to 2018 in three days, almost all of it new rules. A trial that shortened the two files cut about 320 words, and 4 to 7 of its 45 cuts changed a rule, such as dropping "Weigh the options and choose the best"; a subagent that compared the texts missed them.

Splitting a specification numbers its requirements again and renames the IDs in its tests, as the [specification rules](/docs/conventions/specs.md#content) say. [check-docs.py](/.github/scripts/check-docs.py) fails when a link or test name that a split misses names an ID that no longer exists in its file, as [docs-check.md](/docs/decisions/docs-check.md) decides. It cannot tell when an ID still exists but now names another requirement, and it does not read an ID in prose or in a string, such as "rooms 1-8" in a cell of a netcode table.

Codex is signed in, and the `whenparty-notes` folder with the outlines lives, only on the user's Mac. A commit, push and pull request come after the user approves the change, as [Pull requests](/docs/conventions/workflow.md#pull-requests) says, and the token of GitHub Actions may not open pull requests in this repository.

Several documents can be over 1000 words at once. A session of the desktop app can start other sessions, each with a conversation of its own, or propose them for the user to start.

## Options

This decision has four parts.

Where the pass runs:

- A scheduled task of the Claude desktop app on the Mac. It has Codex, the outlines and the worktrees, so it can tell which documents other work is changing. It does not run while the Mac sleeps; a missed week runs once later.
- A scheduled cloud session of Claude Code. It runs when the Mac is off. It has neither Codex nor the outlines, and its work is lost unless it pushes a branch before the user approves it.
- An agent in GitHub Actions. It needs a secret with a token, which the checks of `ci.yml` do without, has neither Codex nor the outlines, and cannot open a pull request.

What the pass changes before the user answers:

- Every document, the rules of work included, and the user approves the finished change. The user answers fewer questions. A change of a rule file costs 0.5 to 0.9 million tokens before the user sees it, and a refusal wastes them; the rules of work change before the user agrees, which the [Decisions section](/docs/conventions/workflow.md#decisions) does not allow.
- Specifications and the other documents, while for a rule of work it first sends a plan. One more question in a week with a rule file, and a refusal costs only the plan.

How a split of a specification treats requirement IDs:

- They are numbered again, and a subagent then checks every test and specification against each other. An ID always tells its file. The check costs tokens at each split.
- A requirement keeps its ID when it moves, and a new one takes the next number ever used. Nothing is renamed, and a stale link fails the check. An ID no longer tells its file.

How many long documents a run takes, and where the user approves each:

- One document a week, in the session of the pass. Each week's change stays small. The other long documents wait a week each, and keep growing while they wait.
- Every long document, one after another in the session of the pass, each in a pull request of its own. It needs only one session. The user approves every document in one conversation, which mixes their questions and outgrows the context of the session.
- Every long document, each in a session that the pass starts. The user approves each document in a conversation of its own, and the sessions work at once. It relies on the app letting the pass start sessions, or on the user starting them from proposals, and spends the tokens of every document on one day.

## Decision

A scheduled task of the desktop app, because the pass needs Codex to check that shortened text keeps its meaning and the outlines and worktrees to leave alone what other work changes, and a missed week costs less than a cloud session that cannot check its own change.

The pass changes specifications and the other documents itself and sends a plan for a rule of work, because a rule of work changes only after the user agrees and a refused plan wastes nothing. It cuts only text that adds nothing, and Codex checks that no rule is lost, because the trial showed that a cut can drop a rule unseen.

A split of a specification numbers its requirements again, and the [`spec-test-verifier` subagent](/.claude/agents/spec-test-verifier.md) then checks every test, specification and reference, so that an ID keeps telling its file and the IDs that no script sees are found.

Each run takes every long document, each in a session that the pass starts, because no long document waits weeks for its turn while it keeps growing, the user approves each document apart, and each conversation holds only its document. When the app does not let the pass start a session, a proposal leaves the start to the user.

## Consequences

- The [`docs-weekly` skill](/.claude/skills/docs-weekly/SKILL.md) and the [`spec-test-verifier` subagent](/.claude/agents/spec-test-verifier.md).
- The scheduled task in [docs-weekly-setup.md](/.claude/docs/docs-weekly-setup.md).
- The rules on splitting in [writing.md](/docs/conventions/writing.md) and [specs.md](/docs/conventions/specs.md#content) and the Codex case in [workflow-checks.md](/docs/conventions/workflow-checks.md#codex).
