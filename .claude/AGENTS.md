# Claude Code

`.claude/` holds the Claude Code settings, hooks, skills and subagents of this repository. It is not a [project](/docs/glossary.md#project) and has no specification.

- [docs/configuration.md](/.claude/docs/configuration.md): which files of `.claude/` git tracks, what [settings.json](/.claude/settings.json) asks to confirm, how a description decides when a skill or subagent is used, which tools the review subagents have and why, and when a change takes effect. Read it before changing any file in `.claude/`.
- [hooks/AGENTS.md](/.claude/hooks/AGENTS.md): the hooks that `settings.json` registers, how they work and how to test them, and an evaluation of whether agents read the documents a task needs before they edit, and whether they change the files it needs.
- [skills/decide/SKILL.md](/.claude/skills/decide/SKILL.md): the `decide` skill, which prepares a decision for the user when the [Decisions section](/docs/conventions/workflow.md#decisions) of the workflow says to stop.
- [agents/docs-reviewer.md](/.claude/agents/docs-reviewer.md): the `docs-reviewer` subagent, which checks documents against the conventions files for the reviews in [workflow-checks.md](/docs/conventions/workflow-checks.md).
- [agents/behaviour-reviewer.md](/.claude/agents/behaviour-reviewer.md): the `behaviour-reviewer` subagent, which checks how a specified system behaves, for the review of a specification edit that changes behaviour in [workflow-checks.md](/docs/conventions/workflow-checks.md).
