# Weekly pass setup

The [`docs-weekly` skill](/.claude/skills/docs-weekly/SKILL.md) runs once a week from a scheduled task of the Claude desktop app on the Mac of the person who works in this repository. The task lives in the app, outside the repository, and its prompt only starts the skill, so the steps of the pass change with the skill. [weekly-pass.md](/docs/decisions/weekly-pass.md) explains why the pass runs there.

Before the task, set up Codex as [codex-setup.md](/.claude/docs/codex-setup.md) says. Then add a local scheduled task in the desktop app, as its [scheduled tasks](https://code.claude.com/docs/en/desktop-scheduled-tasks) page describes:

- name `docs-weekly`;
- folder: the main checkout of the repository, with the worktree option off, so that the session starts there;
- schedule: weekly, Monday at 09:00;
- permission mode: the one you work in, such as Auto;
- prompt: `Run the docs-weekly skill of this repository: read .claude/skills/docs-weekly/SKILL.md and follow it.`

The task runs while the app is open and the Mac is awake. A run that it misses in the last seven days starts once when the app opens or the Mac wakes.
