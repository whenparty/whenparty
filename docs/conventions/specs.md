# Specifications

A [module](../glossary.md#module) keeps its documentation in its own `docs/` folder and describes its behaviour in `docs/specs/`, one file per topic. Every module has `docs/specs/`. The specification describes the module's observable behaviour: what anyone outside the module, a person or a program, can see it do or rely on. Internal state and implementation choices are not part of it. The module's `AGENTS.md` states how to work on it: files, commands, architecture constraints and verification.

## Content

- The specification on `main` describes the behaviour implemented on `main`. On a branch, it also describes the part of a change that the branch implements, including requirements its code does not meet yet. When behaviour changes, rewrite or delete the requirement in place. Reasons for a change belong in commit messages and in the pull request description when there is one.
- Number each specification file and give it a short topic name, such as `1-match.md`. A requirement's ID is the file number and the requirement's number in that file, such as `1-3`. IDs are local to the module. To refer to a requirement of another module, link to its file. Never reuse the number of a deleted file or requirement.
- A module's `AGENTS.md` lists the requirements of other modules that rely on its behaviour.
- State each rule once, precisely enough that its boundaries follow from it, in the terms of the domain.

## Planned changes

- The module's `docs/PLANNED.md` lists accepted changes that are not in the specification yet, including the remaining parts of work that reaches `main` in several parts. It does not describe the system. When work on an item starts, move it into the specification and delete it from `docs/PLANNED.md`. Delete cancelled items.
