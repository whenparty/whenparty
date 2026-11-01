# Testing the hooks

To test a hook, pipe a made-up input into it from the repository root and check its output and exit code. For a tool event, the input has `session_id`, `hook_event_name`, `tool_name` and `tool_input`, and for a subagent also `agent_id`; a `SessionStart` input has `cwd` instead of the tool fields. doc-context.sh keeps a record of what was read for each `session_id` and `agent_id`. Use the same `session_id` across the steps of one test, a new one for each test, and `TMPDIR` set to a scratch folder:

```sh
echo '{"session_id":"test-1","hook_event_name":"PreToolUse","tool_name":"Edit","tool_input":{"file_path":"'"$PWD"'/AGENTS.md"}}' | TMPDIR=/path/to/scratch CLAUDE_PROJECT_DIR=$PWD .claude/hooks/doc-context.sh
```

To test the hook settings, start a new session with `claude -p`, ask it to edit a file without reading anything first, and check that the first edit is denied with a list of documents.
