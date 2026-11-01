# Configuration

These notes say how to change the files in `.claude/`, which [.claude/AGENTS.md](/.claude/AGENTS.md) maps.

- Git ignores everything in `.claude/` except `AGENTS.md`, `settings.json`, `docs/`, `hooks/`, `agents/` and `skills/`, as [.gitignore](/.gitignore) sets. A new file that everyone needs gets an exception there. Other files, such as `settings.local.json`, stay on one machine.
- The `description` of a skill or subagent decides when Claude Code uses it. Each description names when the workflow calls for it; update it when the workflow changes.
- The `reviewer` subagent has no Edit or Write tool, so that it only suggests changes. It keeps Bash for git commands, so only its instructions keep it from writing files through Bash.
- [settings.json](/.claude/settings.json) registers the hooks. It also asks for confirmation before editing specification files, `docs/PLANNED.md` or any `package.json`. An `Edit` rule covers every built-in tool that writes files, but not Bash, so a command such as `sed -i` changes these files without asking.
- It also asks before `pnpm add`, `pnpm install` and `pnpm i`, with or without options before the command. These confirmations, and the one for `package.json`, support the rule on new package dependencies in the [Decisions section](/docs/conventions/workflow.md#decisions). They also ask for changes that need no decision, such as an edit of the scripts, a version change, `pnpm install` without a package name, or another `pnpm` command that contains ` i `. They do not cover `npm`, `yarn` or `pnpm pkg set`.
- A change to `settings.json`, its hook entries included, takes effect in sessions that are already running, and a change to a hook script takes effect at its next run. So a broken hook can deny edits in the session that changed it.
