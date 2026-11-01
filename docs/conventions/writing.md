# Writing

These rules apply to every document, and to responses where they say so. The other conventions files that the [map](/AGENTS.md) lists add rules for the kinds of files they cover, such as the [folder document rules](/docs/conventions/folder-docs.md).

- Use the minimum text needed in documents and responses.
- Describe only current behaviour. Replace or delete superseded text without adding change histories or before-and-after narratives. Keep history in Git. Reasons for a change belong in commit messages and in the pull request description when there is one. The [specification rules](/docs/conventions/specs.md) say how a specification and `docs/PLANNED.md` describe changes that are not on `main` yet.
- Only [decision records](/docs/conventions/decisions.md) weigh a choice against the options it rejected and describe the decision it replaced. Other documents may state the fact a rule depends on.
- Describe each rule in one place and link to it elsewhere.
- Give each document one purpose and one area it applies to, such as one kind of file, one project or one module.
- Name a document after its purpose and area. When a split or a new document needs a name, check two names: after a split, whether the old name still fits the document that keeps it; and whether a document in the same folder already has the name that fits the new one best. Rename that document when another name describes it better; if you do not rename it, give the new document another name. A rename updates every link and path to the document in the same change, code included.
- A Markdown document has at most 800 words, counted as the command below counts them: the runs of characters between spaces, tabs and line breaks, except in a block that opens with a `` ```mermaid `` line and closes at the next line that starts with `` ``` ``, both possibly indented with spaces. A block that never closes is counted. A document over the limit is brought under it in the change that edits it, as the [Decisions section](/docs/conventions/workflow.md#decisions) of the workflow describes. A split makes documents that each cover a narrower part of its purpose or area, as the next rule describes.
  ```sh
  LC_ALL=C awk '/^ *```mermaid *$/ { m = 1; k = 0; next } m && /^ *```/ { m = 0; next } m { k += NF; next } { n += NF } END { print n + m * (k + 1) }'
  ```
- When part of a document has another purpose or area, make it a topic of its own: a title that states its purpose, text that reads without the rest of the document, and links to related rules. Move it to the document with that purpose and area, or to a new one when no document has it, and link to it from where it was. A part can be a whole section or a few paragraphs of one.
- Add documents only when existing references cannot supply the context needed for the task. Describe behaviour and contracts without retelling code.
- In a README or a specification, show states and transitions, flows with branches and how parts connect as a diagram where that is shorter or clearer than sentences or lists. Draw it as Mermaid code in a `mermaid` code block, not as an image file or a drawing in plain text, and keep its labels to a few words. Other documents, such as an `AGENTS.md`, the files in a `docs/` folder other than a specification, and decision records, have no diagrams. A file tree is not a diagram and stays plain text in any document.
- In any document, show items that share the same fields as a table where that is shorter or clearer than sentences or lists. The text around a diagram or table adds only what it cannot show.
- Write for a reader who knows the repository documentation but not the discussions behind it. Do not refer to conversations or agreements. Define a term that can be read in more than one way in the [glossary](/docs/glossary.md), and link to it where it is used.

## Links

- Inside one of the [projects](/docs/glossary.md#project) that the [map](/AGENTS.md) lists, such as `games/`, including all its subprojects and modules, link with relative paths, such as `../p2p/AGENTS.md`. Link to anything outside that project with a path from the repository root that starts with `/`, such as `/infra/nginx/conf.d/`.
- Documents outside those projects, such as the root `AGENTS.md` and `README.md` and everything in the root `docs/`, link to other files only with paths from the repository root.
- A link to a heading in the same file uses only the anchor, such as `#subproject`.
