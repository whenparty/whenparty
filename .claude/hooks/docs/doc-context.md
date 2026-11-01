# doc-context.sh

[doc-context.sh](/.claude/hooks/doc-context.sh) makes the agent read the root documents and the `AGENTS.md` files a file needs before it edits the file. The agent finds the other documents a task needs through the maps in those files, as the [workflow](/docs/conventions/workflow.md#starting) says; the hook does not check that. [required-reading.md](/docs/decisions/required-reading.md) explains why the hook lists paths and denies edits, and why it requires only these documents.

- When a session starts, resumes, is cleared or compacted, it forgets what the agent has read and lists the root documents: the root `AGENTS.md`, and `workflow.md`, `workflow-specs.md`, `workflow-checks.md` and `writing.md` in `docs/conventions/`. The hook names them in its code, so renaming them, or changing the list of documents that the root `AGENTS.md` says to read before any change, needs a change to the hook. It also shows the changes to every `docs/specs/` and `docs/PLANNED.md` since the branch left `main`, uncommitted ones included. A new file appears there only after `git add`. When the diff is longer than 8,000 bytes, which leaves room for the list under the 10,000-character cut that [common.md](/.claude/hooks/docs/common.md) describes, the hook gives the `git diff` command instead.
- After a Read of the whole file or a Write, it records the file as read. A Read with `offset` or `limit`, an Edit and a NotebookEdit do not count.
- After the agent reads or edits a file in or below a folder with an `AGENTS.md` other than the root, the hook lists the documents the file needs, apart from the root documents, that the agent has not read yet. It does this once for each deepest such folder.
- Before Edit, Write or NotebookEdit, it denies the edit when the agent has not read all the documents the file needs, and lists those. A file needs:
  - the root documents;
  - the `AGENTS.md` of every folder on its path;
  - the `AGENTS.md` of the folder of each `@whenparty/*` package that the `package.json` of the deepest folder on its path with an `AGENTS.md` lists in `dependencies` or `devDependencies`. The workflow does not require these; required-reading.md says why the hook does.

  Only files that git tracks and that exist on disk are needed, and never the file being edited.
- The main agent and each subagent have their own record of what they have read. A subagent gets no list of root documents when it starts, so its first edit is denied with the full list. The records live in `whenparty-doc-context/` under `$TMPDIR`, or under `/tmp` when it is not set.
- A file read through Bash, such as with `cat`, does not count as read, and edits through Bash are not checked.
