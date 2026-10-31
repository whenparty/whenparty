# WhenParty

This repository holds everything that runs on the WhenParty VPS. [README.md](/README.md) describes how it is deployed and served. Its top-level folders, apart from `docs/`, `.github/` (CI workflows) and `.claude/` (Claude Code settings and hooks), are [projects](/docs/glossary.md#project):

- `infra/`: the nginx proxy that terminates TLS for every site.
- `www/`: the When Party site at `www.when.party`.
- `nii-au/`: the site at `www.nii.au`.
- `temp-sites/`: temporary sites on `*.when.party` and the Traefik router that serves them.
- `games/`: peer-to-peer browser games and the platform they share.

## Documents

- This file maps the repository and its documents.
- Every project and [module](/docs/glossary.md#module) that has or needs a specification has an `AGENTS.md`, and other folders may have one; the bullet on what code cannot express says when one is added. Every `AGENTS.md`, this file included, has the parts that the [documentation conventions](/docs/conventions/documentation.md#agentsmd) list. `games/AGENTS.md` names the [subprojects](/docs/glossary.md#subproject) of `games/` and the platform's modules and says which of them need a specification. `games/titles/AGENTS.md` lists the titles.
- A `README.md` is a short text for people about what a folder holds and how to use it. A folder that people deploy, run or use, such as the root, `www/` and `temp-sites/`, has one unless the README of a folder above it covers it. It does not hold what `AGENTS.md` holds.
- A project's or module's specification lives in its `docs/specs/`, one numbered file per topic. It follows the [specification rules](/docs/conventions/specs.md), which also add a part to its `AGENTS.md`: the list of requirements of other specifications that rely on it.
- The `docs/PLANNED.md` of a project or module with a specification lists accepted changes that are not in its specification yet. It exists while there are such changes. It follows the specification rules.
- A decision record explains why a choice was made when a rejected option also had real advantages. Records about the whole repository live in the root `docs/decisions/`, records about a project in that project's `docs/decisions/`. They follow the [decision record rules](/docs/conventions/decisions.md).
- Other documents of a project or module live in its `docs/` folder and hold what its specification, the decision records about it and its `AGENTS.md` do not.
- What code cannot express goes where the bullets above put it: behaviour in the specification, when there is one; the reason for a choice that needs a decision record, in that record; how to use a folder, in its README. What you need to know to change code goes in the `AGENTS.md` of the code's folder or the nearest folder above it that has one, other than the root, or in a document that it links to. When the root one is the only `AGENTS.md` there, the innermost project or module that contains the code gets one, or, outside projects, its top-level folder, such as `.github/`. Knowledge about code in several folders goes in the nearest `AGENTS.md` above all of it, other than the root one. When there is none, the note goes in the `AGENTS.md` for the code that must change when the other code changes, and the `AGENTS.md` for the other code, added as above if needed, links to it. Knowledge about files in the root itself goes in the root `AGENTS.md`.
- The conventions files in `docs/conventions/`, listed below, hold the rules for each kind of file and for how to work.
- The [glossary](/docs/glossary.md) defines the terms that documents use and that can be read in more than one way.
- [Open questions](/docs/open-questions.md) lists undecided questions about the rules. The [workflow rules](/docs/conventions/workflow-changes.md) say when a question is added and deleted.

## Conventions files

- [documentation.md](/docs/conventions/documentation.md): every document, and responses where its rules say so. The other conventions files add rules for the kinds of files they cover.
- [specs.md](/docs/conventions/specs.md): specifications, `docs/PLANNED.md` and the list of relying requirements in an `AGENTS.md`.
- [decisions.md](/docs/conventions/decisions.md): decision records.
- [tests.md](/docs/conventions/tests.md): test files.
- [code.md](/docs/conventions/code.md): source code and test code, the files code loads, such as styles and assets, and configs and scripts, including `.github/workflows`.
- [workflow-changes.md](/docs/conventions/workflow-changes.md): how to start a task, when to stop and ask, when to write a decision record, and how specifications and code change.
- [workflow-checks.md](/docs/conventions/workflow-checks.md): what to check in documents and code while working on a change.

A rule lives in the file that covers what the rule constrains. Rules about how to work anywhere in the repository, such as the order of steps or when to stop and ask, live in the workflow files. The `AGENTS.md` of a folder adds its own commands and checks.

Before any change, read both workflow files and follow them.
