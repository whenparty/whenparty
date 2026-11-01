# Hooks

`.claude/hooks/` holds the Claude Code hooks of this repository, which [settings.json](/.claude/settings.json) registers. [.claude/AGENTS.md](/.claude/AGENTS.md) describes the rest of `.claude/`.

## Working here

The key files:

- [doc-context.sh](/.claude/hooks/doc-context.sh) makes the agent read the documents a file needs before it edits the file. [doc-context.md](/.claude/hooks/doc-context.md) describes how it works.
- [word-limit.sh](/.claude/hooks/word-limit.sh) asks the agent to propose how to bring a Markdown document under the word limit after each edit that leaves it longer.
- [repo-path.sh](/.claude/hooks/repo-path.sh) is not a hook. Both hooks source it to find the path of a file in the repository and to tell whether git ignores it.

The hooks are POSIX shell scripts that read the hook input as JSON on stdin. They need `git` and `jq`; without either they do nothing. They act only on files of this repository and its worktrees that git does not ignore. Claude Code cuts any text a hook adds to the context at 10,000 characters.

### word-limit.sh

The hook runs after Edit or Write of a Markdown file. It reads the word limit from the phrase "at most N words" in the [writing rules](/docs/conventions/writing.md) and counts words with the same command they give. When the phrase is missing, it exits with code 2, so the agent sees the error. When the file is longer than the limit, it returns `decision: "block"`. Its reason asks the agent, once the new text is placed, to propose how to bring the document under the limit, or to follow what the user has already decided about it. The edit itself stays. The `words` job of [ci.yml](/.github/workflows/ci.yml) reads the limit and counts the same way for Markdown files of each pull request and push to `main`. Change the hook and the job together.

## Testing

To test a hook, pipe a made-up input into it from the repository root and check its output and exit code. For a tool event, the input has `session_id`, `hook_event_name`, `tool_name` and `tool_input`. doc-context.sh keeps a record of what was read for each `session_id`. Use the same one across the steps of one test, a new one for each test, and `TMPDIR` set to a scratch folder:

```sh
echo '{"session_id":"test-1","hook_event_name":"PreToolUse","tool_name":"Edit","tool_input":{"file_path":"'"$PWD"'/AGENTS.md"}}' | CLAUDE_PROJECT_DIR=$PWD .claude/hooks/doc-context.sh
```

To test the hook settings, start a new session with `claude -p`, ask it to edit a file without reading anything first, and check that the first edit is denied with a list of documents.
