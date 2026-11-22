# Hooks

`.claude/hooks/` holds the scripts of the Claude Code hooks of this repository, which [settings.json](/.claude/settings.json) registers, and an evaluation of whether agents read the [documents](/docs/glossary.md#document) a task needs before they edit, and whether they change the files it needs. [.claude/AGENTS.md](/.claude/AGENTS.md) maps the rest of `.claude/`.

- [docs/common.md](/.claude/hooks/docs/common.md): what the hooks rely on, including [repo-path.sh](/.claude/hooks/repo-path.sh), which the hooks that act on files source, which files they act on and how much text a hook can add. Read it before changing any hook.
- [docs/doc-context.md](/.claude/hooks/docs/doc-context.md): how [doc-context.sh](/.claude/hooks/doc-context.sh) makes the agent read the root documents and the `AGENTS.md` files a file needs before it edits the file. Read it before changing `doc-context.sh`.
- [required-reading.md](/docs/decisions/required-reading.md): the decision record on why doc-context.sh lists paths and denies edits, and why it requires only these documents. Read it before changing which documents the hook requires.
- [docs/ruleset-guard.md](/.claude/hooks/docs/ruleset-guard.md): which Bash commands [ruleset-guard.sh](/.claude/hooks/ruleset-guard.sh) denies: changes to a ruleset or branch protection on GitHub. Read it before changing `ruleset-guard.sh`.
- [agent-ruleset-changes.md](/docs/decisions/agent-ruleset-changes.md): the decision record on why a hook keeps agents from changing the rulesets on `main`, and why it does not check `git push`. Read it before changing what the hook denies or replacing it.
- [docs/format-guard.md](/.claude/hooks/docs/format-guard.md): how [format-guard.sh](/.claude/hooks/format-guard.sh) checks the files of a branch with Prettier before a `git commit`. Read it before changing `format-guard.sh`.
- [docs/testing.md](/.claude/hooks/docs/testing.md): how to test a hook with made-up inputs and with `claude -p`.
- [docs/evaluation.md](/.claude/hooks/docs/evaluation.md): how the evaluation in `evals/` checks whether agents reach the documents a task needs through the maps and change the files it needs, when to run it, how to run it and how to write its tasks.
