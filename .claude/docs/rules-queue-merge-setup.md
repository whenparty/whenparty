# Rules queue merge setup

The [`rules-queue-merge` skill](/.claude/skills/rules-queue-merge/SKILL.md) runs each day from a scheduled task of the Claude desktop app on the Mac of the person who works in this repository, where the `whenparty-notes` folder lives. The task lives in the app, outside the repository, and its prompt only starts the skill, so the steps change with the skill.

Before the task, set up Codex as [codex-setup.md](/.claude/docs/codex-setup.md) says. Then add a local scheduled task in the desktop app, as its [scheduled tasks](https://code.claude.com/docs/en/desktop-scheduled-tasks) page describes:

- name `rules-queue-merge`;
- folder: the main checkout of the repository, with the worktree option on, so that the app makes the task's worktree from `main` whatever branch the main checkout is on;
- schedule: daily at 9:00;
- permission mode: the one you work in, such as Auto;
- prompt: `Run the rules-queue-merge skill of this repository: read .claude/skills/rules-queue-merge/SKILL.md and follow it.`

The task runs while the app is open and the Mac is awake. The app fetches before it makes the worktree only when it has not fetched in the last 24 hours, so the worktree can be up to a day behind `origin/main`; step 1 of the skill catches that for `.claude/`, and step 3 brings the branch to `origin/main`.
