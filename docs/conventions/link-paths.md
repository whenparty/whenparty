# Link paths

These rules say how the links in every [document](/docs/glossary.md#document) write their paths, in addition to the [writing rules](/docs/conventions/writing.md).

- Inside one of the [projects](/docs/glossary.md#project) that the [map](/AGENTS.md) lists, such as `games/`, including all its [subprojects](/docs/glossary.md#subproject) and [modules](/docs/glossary.md#module), link with relative paths, such as `../rooms/AGENTS.md`. Link to anything outside that project with a path from the repository root that starts with `/`, such as `/infra/nginx/conf.d/`.
- Documents outside those projects, such as the root `AGENTS.md` and `README.md` and everything in the root `docs/`, link to other files only with paths from the repository root.
- A link to a heading in the same file uses only the anchor, such as `#subproject`.
