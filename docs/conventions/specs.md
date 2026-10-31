# Specifications

A [project](/docs/glossary.md#project) or [module](/docs/glossary.md#module) needs a specification when the `AGENTS.md` of a project that contains it says so. Otherwise a specification is optional. These rules apply to every specification, to its `docs/PLANNED.md` and to the list of relying requirements in its `AGENTS.md`.

A project or module with a specification keeps it in its own `docs/specs/` folder, one file per topic, and its other documentation in `docs/`. A project's specification describes its observable behaviour: what its users, people or other projects, can see it do or rely on. A module's specification describes only its [boundary](/docs/glossary.md#module). What other projects rely on belongs to the specification of the project that holds the module. Internal state and implementation choices are not part of a specification.

## Content

- The specification on `main` describes the behaviour implemented on `main`. On a branch, it also describes the part of a change that the branch implements, including requirements its code does not meet yet. When behaviour changes, rewrite or delete the requirement in place.
- Number each specification file and give it a short topic name, such as `1-match.md`. A requirement's ID is the file number and the requirement's number in that file, such as `1-3`. IDs are local to one specification. To refer to a requirement of another specification, link to its file. Never reuse the number of a deleted file or requirement.
- The `AGENTS.md` of a project or module lists the requirements of other specifications that rely on its behaviour.
- State each rule precisely enough that its boundaries follow from it, in the terms of the domain.

## Planned changes

- The `docs/PLANNED.md` of a project or module lists accepted changes that are not in the specification yet, including the remaining parts of work that reaches `main` in several parts. It does not describe the system. When work on an item starts, move it into the specification and delete it from `docs/PLANNED.md`. Delete cancelled items.
