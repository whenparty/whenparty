# Hooks

`.claude/hooks/` holds the Claude Code hooks of this repository, which [settings.json](/.claude/settings.json) registers. [.claude/AGENTS.md](/.claude/AGENTS.md) describes the rest of `.claude/`.

## Working here

The key files:

- [doc-context.sh](/.claude/hooks/doc-context.sh) makes the agent read the documents a file needs before it edits the file.
- [word-limit.sh](/.claude/hooks/word-limit.sh) asks the agent to propose a split after each edit of a Markdown document that is longer than the word limit.
- [repo-path.sh](/.claude/hooks/repo-path.sh) is not a hook. Both hooks source it to find the path of a file in the repository and to tell whether git ignores it.

The hooks are POSIX shell scripts that read the hook input as JSON on stdin. They need `git` and `jq`; without either they do nothing. They act only on files of this repository and its worktrees that git does not ignore. Claude Code cuts any text a hook adds to the context at 10,000 characters.

### doc-context.sh

The hook enforces only the documents a file needs, as listed below. The workflow rules on what to read, such as reading every Markdown file before editing a document, still apply. [required-reading.md](/docs/decisions/required-reading.md) explains why the hook lists paths and denies edits, and which documents a file needs.

- When a session starts, resumes, is cleared or compacted, it forgets what the agent has read and lists the root documents: the root `AGENTS.md` and `README.md` and every Markdown file in or below `docs/`. It also shows the changes to every `docs/specs/` and `docs/PLANNED.md` since the branch left `main`, uncommitted ones included. A new file appears there only after `git add`. When the diff is longer than 8,000 characters, which leaves room for the list under the 10,000-character cut, the hook gives the `git diff` command instead.
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

### word-limit.sh

The hook runs after Edit or Write of a Markdown file. It reads the word limit from the phrase "at most N words" in the [documentation conventions](/docs/conventions/documentation.md). When the phrase is missing, it exits with code 2, so the agent sees the error. When the file is longer than the limit, it returns `decision: "block"`. Its reason asks the agent to propose a split, or to follow what the user has already decided about splitting this document. The edit itself stays.

## Testing

To test a hook, pipe a made-up input into it from the repository root and check its output and exit code. For a tool event, the input has `session_id`, `hook_event_name`, `tool_name` and `tool_input`. doc-context.sh keeps a record of what was read for each `session_id`. Use the same one across the steps of one test, a new one for each test, and `TMPDIR` set to a scratch folder:

```sh
echo '{"session_id":"test-1","hook_event_name":"PreToolUse","tool_name":"Edit","tool_input":{"file_path":"'"$PWD"'/AGENTS.md"}}' | CLAUDE_PROJECT_DIR=$PWD .claude/hooks/doc-context.sh
```

To test the hook settings, start a new session with `claude -p`, ask it to edit a file without reading anything first, and check that the first edit is denied with a list of documents.
