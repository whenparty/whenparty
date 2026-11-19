# Docs check in CI

## Context

[Documents](/docs/glossary.md#document) link to the files, headings and requirements they rely on, as the [writing rules](/docs/conventions/writing.md) say, and requirement test files are named after their specification files, and the names of their tests start with the IDs of their requirements, as the [testing rules](/docs/conventions/tests.md) say. A change that renames a file or a heading, or splits a specification and numbers its requirements again, as the [specification rules](/docs/conventions/specs.md) describe, breaks every link and test name it misses, and nothing reported them. At `3177640` on `main`, the documents had 1868 links to files and folders of the repository, 370 of them to headings, 535 requirement IDs in links or written before one, and 315 requirements, all correct. A script checks them all in under a second and spends no model tokens; its job in CI takes a few seconds. Documents also link to code files, such as workflows and configs.

A pull request merges only when the `result` check of `ci.yml` passes, as [github-setup.md](/.github/docs/github-setup.md#main-branch) says, and `result` fails when any check fails, as [checks.md](/.github/docs/checks.md#skipping-and-the-result-job) says; its branch need not be up to date with `main`, as [main-branch-protection.md](/docs/decisions/main-branch-protection.md#decision) decides. `ci.yml` skips with `if:` the checks that only some changes need, as [ci-checks.md](/docs/decisions/ci-checks.md#decision) decides.

## Options

This decision has two parts.

Where the check runs:

- A check in `ci.yml`. The change that breaks a link or leaves a requirement without a test fails, and the session that made it fixes it while it knows what it changed. One more workflow and a script. A broken link anywhere blocks the merge until it is fixed, and a branch that is not up to date with `main` can pass and leave the error to the run on `main`.
- A check once a week, by an agent that goes over the documents. Nothing is added to CI and nothing blocks a merge. A broken link stays for up to a week, and the agent fixes errors in changes it did not make.
- No check. An error stays until a reader runs into it.

Which changes run the check in `ci.yml`:

- Every change. Renaming any file that a document links to fails at once. The check also runs in changes that cannot break a link, for a few seconds each.
- Only changes to Markdown files, test files and specifications, with an `if:`. Fewer runs. A change that renames a code file that a document links to passes, and the link stays broken until a later change runs the check.

## Decision

A check in `ci.yml`, because the check costs no tokens and the session that breaks a link or a test name fixes it at once, while it knows what it changed, which outweighs a merge blocked by a broken link.

It runs for every change, because a renamed code file breaks the links to it as surely as a renamed document, and a few seconds of runner time cost less than a broken link that stays until an unrelated change fails on it.

## Consequences

- [check-docs.yml](/.github/workflows/check-docs.yml), [check-docs.py](/.github/scripts/check-docs.py) and [ci.yml](/.github/workflows/ci.yml).
- [checks.md](/.github/docs/checks.md#the-checks).
