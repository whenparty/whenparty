# WhenParty

This repository holds everything that runs on the WhenParty VPS. [README.md](/README.md) describes how it is deployed and served. Its top-level folders, apart from `docs/`, `.github/` (CI workflows) and `.claude/` (Claude Code settings and hooks), are [projects](/docs/glossary.md#project):

- `infra/`: the nginx proxy that terminates TLS for every site.
- `www/`: the When Party site at `www.when.party`.
- `nii-au/`: the site at `www.nii.au`.
- `temp-sites/`: temporary sites on `*.when.party` and the Traefik router that serves them.
- `games/`: peer-to-peer browser games and the platform they share.

## Documents

- This file maps the repository and its documents. It follows the [documentation conventions](/docs/conventions/documentation.md).
- A `README.md` tells people what a folder holds and how it is deployed, run and tested. The root and folders such as `www/` and `temp-sites/` have one. It follows the documentation conventions.
- `games/AGENTS.md` names the subprojects of `games/` and the platform's [modules](/docs/glossary.md#module), says which of them need a specification and holds commands and rules shared by all games. `games/titles/AGENTS.md` lists the titles. They follow the documentation conventions.
- The `AGENTS.md` of a project or module that has or needs a specification states how to work on it. It follows the [specification rules](/docs/conventions/specs.md).
- A project's or module's specification lives in its `docs/specs/`, one numbered file per topic. It follows the specification rules.
- The `docs/PLANNED.md` of a project or module lists accepted changes that are not in its specification yet. It exists while there are such changes. It follows the specification rules.
- Other documents of a project or module live in its `docs/` folder and hold what its specification and `AGENTS.md` do not. They follow the documentation conventions.
- The conventions files in `docs/conventions/`, listed below, hold the rules for each kind of file and for how to work. Adding one is a decision for the user, like any new kind of document (see the [workflow rules](/docs/conventions/workflow-changes.md)). Conventions files follow the documentation conventions.
- The [glossary](/docs/glossary.md) defines the terms that documents use and that can be read in more than one way. It follows the documentation conventions.
- [Open questions](/docs/open-questions.md) lists undecided questions about the rules. The workflow rules say when a question is added and deleted. It follows the documentation conventions.

## Conventions files

- [documentation.md](/docs/conventions/documentation.md): responses and every document that the list above does not give to another file.
- [specs.md](/docs/conventions/specs.md): the documents of projects and modules that the list above gives to it.
- [tests.md](/docs/conventions/tests.md): test files.
- [code.md](/docs/conventions/code.md): source code and the files it loads, such as styles and assets.
- [workflow-changes.md](/docs/conventions/workflow-changes.md): how to start a task, when to stop and ask, and how specifications and code change.
- [workflow-checks.md](/docs/conventions/workflow-checks.md): what to check in documents and code while working on a change.

A rule lives in the file that covers what the rule constrains. Rules about how to work, such as the order of steps or when to stop and ask, live in the workflow files.

Before any change, read both workflow files and follow them.
