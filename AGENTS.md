# WhenParty

This repository holds everything that runs on the WhenParty VPS. [README.md](/README.md) describes how it is deployed and served. Its top-level folders, apart from `docs/`, `.github/` (CI workflows) and `.claude/` (Claude Code settings and hooks), are [projects](/docs/glossary.md#project):

- `infra/`: the nginx proxy that terminates TLS for every site.
- `www/`: the When Party site at `www.when.party`.
- `nii-au/`: the site at `www.nii.au`.
- `temp-sites/`: temporary sites on `*.when.party` and the Traefik router that serves them.
- `games/`: peer-to-peer browser games and the platform they share.

## Documents

- This file maps the repository and its documents.
- Every project and [module](/docs/glossary.md#module) that has or needs a specification has an `AGENTS.md`, and other folders may have one. Every `AGENTS.md`, this file included, has the parts that the [documentation conventions](/docs/conventions/documentation.md#agentsmd) list. `games/AGENTS.md` names the [subprojects](/docs/glossary.md#subproject) of `games/` and the platform's modules and says which of them need a specification. `games/titles/AGENTS.md` lists the titles.
- A `README.md` is a short text for people about what a folder holds and how it works. The root and folders such as `www/` and `temp-sites/` have one.
- A project's or module's specification lives in its `docs/specs/`, one numbered file per topic. It follows the [specification rules](/docs/conventions/specs.md), which also add a part to its `AGENTS.md`: the list of requirements of other specifications that rely on it.
- The `docs/PLANNED.md` of a project or module lists accepted changes that are not in its specification yet. It exists while there are such changes. It follows the specification rules.
- A decision record explains why a choice was made when a rejected option also had real advantages. Records about the whole repository live in the root `docs/decisions/`, records about a project in that project's `docs/decisions/`. They follow the [decision record rules](/docs/conventions/decisions.md).
- Other documents of a project or module live in its `docs/` folder and hold what its specification, the decision records about it and its `AGENTS.md` do not.
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
