# Package runners in Claude Code

## Context

- `npx`, `npm x` and `npm exec` run a command from an npm package and download the package when the folder has not installed it, and `pnpm dlx`, whose short form is `pnpx`, always runs a package that it downloads or has cached recently. Agents run the tools of the repository through its scripts and `pnpm exec`, and no document tells an agent to run a package runner.
- On 2026-11-20 an agent put `npx -y -p typescript@5 true` into a typecheck command. The person's own settings ask before `npx` and `npm exec`, and the command waited 10 hours for that confirmation while the person was away, with the work stopped. Nothing asked before `pnpm dlx`.
- In Claude Code, a denial wins over a confirmation and a permission in any settings file and holds in every permission mode, as [configuration.md](/.claude/docs/configuration.md) says; the agent gets the refusal at once and can run the tool through the repository's scripts or `pnpm exec`. A permission cannot make an exception to a denial, so a denial of `pnpx` would also refuse `pnpx modern-web-guidance@latest search` and `retrieve`, which the repository's settings allow for Google's skill, as [web-guidance.md](/docs/decisions/web-guidance.md) decides. The skill writes its commands with `npx -y` and says to prefer `pnpx` when pnpm is installed, which every machine that works on the games has.
- A rule with a word between two wildcards, such as `npm * exec *`, also refuses a command that has that word as an argument between others, such as `npm run exec --silent`.
- Claude Code's `permissions.denyInsteadOfPrompting`, which only a person's own or managed settings can set, refuses every call that would wait for a confirmation.

## Options

- A confirmation before each runner, as a person's own settings have. A person can allow one run, such as of a tool that the workspace lacks. But the command waits until someone answers, and an agent that works while the person is away stops there.
- A denial of `npx`, `npm x`, and of `npm exec` and `pnpm dlx` also after options, in the repository's settings. The command fails at once, the agent runs the tool through the repository's scripts, and the rule reaches every person and session that works here. But nobody can allow one run, `npx` of a binary that the folder has installed fails too, and the skill's `npx` commands fail, so the agent has to use `pnpx`, and on a machine without pnpm the skill cannot run.
- The same denial with `npm * x *`. It also refuses `npm x` after options, such as `npm --yes x pkg`. But a one-letter `x` is a likelier argument than `exec` or `dlx`, such as a file, a test or a script name, so it would refuse ordinary npm commands more often.
- The same denial with `pnpx`. It also closes downloads through `pnpx`. But it refuses Google's CLI, which the repository allows.
- The same denial in each person's own settings. It covers their other repositories too. But each person sets it up on each machine, and a session of a person without it waits again.
- `denyInsteadOfPrompting` in each person's own settings. No command waits for anyone. But it also refuses the confirmations that the repository wants a person to see, such as of an edit of a `package.json` or of `pnpm install`, and each person sets it up.

## Decision

The denial in the repository's settings, without `npm * x *` and without `pnpx`. A wait for a confirmation stopped the work for 10 hours, while the tools that agents need are in the workspace already. A run that only a runner gives is rare, and a person can make it outside Claude Code. Google's CLI keeps running through `pnpx`.

## Consequences

- [settings.json](/.claude/settings.json) and its notes in [configuration.md](/.claude/docs/configuration.md).
