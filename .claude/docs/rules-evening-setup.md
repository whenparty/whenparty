# Evening change setup

The [`rules-evening` skill](/.claude/skills/rules-evening/SKILL.md) runs each evening from a scheduled task of the Claude desktop app on the Mac of the person who works in this repository, where the `whenparty-notes` folder lives. The task lives in the app, outside the repository, and its prompt only starts the skill, so the steps change with the skill.

Before the task, set up Codex as [codex-setup.md](/.claude/docs/codex-setup.md) says. Then add a local scheduled task in the desktop app, as its [scheduled tasks](https://code.claude.com/docs/en/desktop-scheduled-tasks) page describes:

- name `rules-evening`;
- folder: the main checkout of the repository, with the worktree option off, since the skill makes its own worktree;
- schedule: daily at 21:00;
- permission mode: the one you work in, such as Auto;
- prompt: `Run the rules-evening skill of this repository: read .claude/skills/rules-evening/SKILL.md and follow it.`

The task runs while the app is open and the Mac is awake.
