# Links

These rules apply to the links in every document, in addition to the [writing rules](/docs/conventions/writing.md).

- Inside one of the [projects](/docs/glossary.md#project) that the [map](/AGENTS.md) lists, such as `games/`, including all its subprojects and modules, link with relative paths, such as `../p2p/AGENTS.md`. Link to anything outside that project with a path from the repository root that starts with `/`, such as `/infra/nginx/conf.d/`.
- Documents outside those projects, such as the root `AGENTS.md` and `README.md` and everything in the root `docs/`, link to other files only with paths from the repository root.
- A link to a heading in the same file uses only the anchor, such as `#subproject`.
