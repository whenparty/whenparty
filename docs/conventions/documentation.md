# Documentation

These rules apply to every document, and to responses where they say so. The other conventions files that the [map](/AGENTS.md) lists add rules for the kinds of files they cover.

- Use the minimum text needed in documents and responses.
- Describe only current behaviour. Replace or delete superseded text without adding change histories or before-and-after narratives. Keep history in Git. Reasons for a change belong in commit messages and in the pull request description when there is one. The [specification rules](/docs/conventions/specs.md) say how a specification and `docs/PLANNED.md` describe changes that are not on `main` yet.
- Only [decision records](/docs/conventions/decisions.md) weigh a choice against the options it rejected and describe the decision it replaced. Other documents may state the fact a rule depends on.
- Describe each rule in one place and link to it elsewhere.
- Give each document one purpose and one area it applies to, such as one kind of file, one project or one module.
- A Markdown document has at most 800 words, counted over the whole file as `wc -w` counts them. A document that is already longer is split the next time it is edited into documents that each cover a narrower part of its purpose or area, as the next rule describes.
- When part of a document has another purpose or area, make it a topic of its own: a title that states its purpose, text that reads without the rest of the document, and links to related rules. Move it to the document with that purpose and area, or to a new one when no document has it, and link to it from where it was. A part can be a whole section or a few paragraphs of one.
- Add documents only when existing references cannot supply the context needed for the task. Describe behaviour and contracts without retelling code.
- Write for a reader who knows the repository documentation but not the discussions behind it. Do not refer to conversations or agreements. Define a term that can be read in more than one way in the [glossary](/docs/glossary.md), and link to it where it is used.

## AGENTS.md

Every `AGENTS.md`, from the root to a [module](/docs/glossary.md#module), has at least these parts:

- a paragraph that says what its folder is;
- a map of the other documents in the folder and of its parts that have their own documentation, such as [subprojects](/docs/glossary.md#subproject) and modules, with what each holds; a folder with neither has no map;
- how to work there: in the root, which workflow files to read and what you need to know to change the files in the root itself; elsewhere, the folder's key files, architecture constraints, the commands and checks for changing its code, and what the code cannot express but you need to know to change it.

Other conventions files can add parts, such as the list of relying requirements in the specification rules.

## Links

- Inside one of the [projects](/docs/glossary.md#project) that the [map](/AGENTS.md) lists, such as `games/`, including all its subprojects and modules, link with relative paths, such as `../p2p/AGENTS.md`. Link to anything outside that project with a path from the repository root that starts with `/`, such as `/infra/nginx/conf.d/`.
- Documents outside those projects, such as the root `AGENTS.md` and `README.md` and everything in the root `docs/`, link to other files only with paths from the repository root.
- A link to a heading in the same file uses only the anchor, such as `#subproject`.
