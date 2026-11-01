# WhenParty

This repository holds everything that runs on the WhenParty VPS. [README.md](/README.md) describes how it is deployed and served. Its top-level folders, apart from `docs/`, [`.github/`](/.github/AGENTS.md) (CI workflows) and [`.claude/`](/.claude/AGENTS.md) (Claude Code settings, hooks, skills and subagents), are [projects](/docs/glossary.md#project):

- `infra/`: the nginx proxy that terminates TLS for every site.
- [`www/`](/www/README.md): the When Party site at `www.when.party`.
- [`nii-au/`](/nii-au/README.md): the site at `www.nii.au`.
- [`temp-sites/`](/temp-sites/README.md): temporary sites on `*.when.party` and the Traefik router that serves them.
- [`games/`](/games/AGENTS.md): peer-to-peer browser games and the platform they share.

## Documents

- This file maps the repository and its documents.
- Every project and [module](/docs/glossary.md#module) that has or needs a specification has an `AGENTS.md`, and other folders may have one. The [folder document rules](/docs/conventions/folder-docs.md) say what every `AGENTS.md`, this file included, holds and when another folder gets one.
- A `README.md` is for people. The root and every project on the map above have one; a subproject or another folder may have one. It follows the folder document rules.
- A project's or module's specification lives in its `docs/specs/`. Its `docs/PLANNED.md` lists accepted changes that are not in the specification yet. Both follow the [specification rules](/docs/conventions/specs.md).
- A decision record explains why a choice was made. The [decision record rules](/docs/conventions/decisions.md) say when one is written and where it lives.
- Other documents of a folder with an `AGENTS.md` live in or below its `docs/` folder, apart from skills and subagents, which live where the next bullet says. They hold how to work there, and anything else that its specification and the decision records about it do not hold.
- A skill in `.claude/skills/` holds the steps of a task that the rules call for. A subagent in `.claude/agents/` holds the instructions and tools of an agent that the rules call for. [`.claude/AGENTS.md`](/.claude/AGENTS.md) maps them and the hooks.
- The conventions files in `docs/conventions/`, listed below, hold the rules for each kind of file and for how to work.
- The [glossary](/docs/glossary.md) defines the terms that documents use and that can be read in more than one way.
- [Open questions](/docs/open-questions.md) lists undecided questions about the rules. The [workflow rules](/docs/conventions/workflow.md) say when a question is added and deleted.

## Conventions files

- [writing.md](/docs/conventions/writing.md): every document, and responses where its rules say so. The other conventions files add rules for the kinds of files they cover.
- [folder-docs.md](/docs/conventions/folder-docs.md): every `AGENTS.md` and `README.md`, the documents on how to work in a folder, and where what code cannot express goes.
- [specs.md](/docs/conventions/specs.md): specifications, `docs/PLANNED.md` and the list of relying requirements in an `AGENTS.md`.
- [decisions.md](/docs/conventions/decisions.md): decision records.
- [tests.md](/docs/conventions/tests.md): test files.
- [code.md](/docs/conventions/code.md): source code and test code, the files code loads, such as styles and assets, and configs and scripts, including `.github/workflows`.
- [workflow.md](/docs/conventions/workflow.md): how to start a task, when to stop and ask, when to write a decision record, and how to bring a long document under the word limit.
- [workflow-specs.md](/docs/conventions/workflow-specs.md): how specifications and code change, and when to stop and ask about them.
- [workflow-checks.md](/docs/conventions/workflow-checks.md): what to check in documents and code while working on a change.

A rule lives in the file that covers what the rule constrains. Rules about how to work anywhere in the repository, such as the order of steps or when to stop and ask, live in the workflow files, or in a skill or subagent that a workflow file names for that task.

Before any change, read the three workflow files and the writing rules, and follow them.
