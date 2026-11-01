# doc-context.sh

[doc-context.sh](/.claude/hooks/doc-context.sh) makes the agent read the documents a file needs before it edits the file. [AGENTS.md](/.claude/hooks/AGENTS.md) describes what all hooks share and how to test them.

The hook enforces only the documents a file needs, as listed below. The workflow rules on what to read, such as reading every Markdown file before editing a document, still apply. [required-reading.md](/docs/decisions/required-reading.md) explains why the hook lists paths and denies edits, and which documents a file needs.

- When a session starts, resumes, is cleared or compacted, it forgets what the agent has read and lists the root documents: the root `AGENTS.md` and `README.md` and every Markdown file in or below `docs/`. It also shows the changes to every `docs/specs/` and `docs/PLANNED.md` since the branch left `main`, uncommitted ones included. A new file appears there only after `git add`. When the diff is longer than 8,000 characters, which leaves room for the list under the 10,000-character cut that [AGENTS.md](/.claude/hooks/AGENTS.md) describes, the hook gives the `git diff` command instead.
- After a Read of the whole file or a Write, it records the file as read. A Read with `offset` or `limit`, an Edit and a NotebookEdit do not count.
- After the agent reads or edits a file, the hook lists the documents the file needs, apart from the root documents, that the agent has not read yet. It does this once for each deepest folder with an `AGENTS.md` other than the root, or, outside such folders, once for each folder. Files in the root get no list.
- Before Edit, Write or NotebookEdit, it denies the edit when the agent has not read all the documents the file needs, and lists those. A file needs:
  - the root documents;
  - the `AGENTS.md`, `README.md` and Markdown files in or below `docs/` of every folder on its path;
  - every Markdown file in or below the deepest folder on its path, other than the root, that has an `AGENTS.md` that git tracks;
  - every Markdown file in or below the folders of the `@whenparty/*` packages that the `package.json` of that deepest folder lists in `dependencies` or `devDependencies`.

  Only files that git tracks and that exist on disk are needed, and never the file being edited.
- The main agent and each subagent have their own record of what they have read. A subagent gets no list of root documents when it starts, so its first edit is denied with the full list. The records live in `whenparty-doc-context/` under `$TMPDIR`, or under `/tmp` when it is not set.
- A file read through Bash, such as with `cat`, does not count as read, and edits through Bash are not checked.
