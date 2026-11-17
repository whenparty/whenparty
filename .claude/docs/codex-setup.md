# Codex setup

The [`codex` skill](/.claude/skills/codex/SKILL.md) runs OpenAI Codex CLI with `-p claude`, which picks the profile `~/.codex/claude.config.toml`. Do this once on each machine:

1. `brew install --cask codex` installs Codex CLI.
2. `codex login` signs in to OpenAI, and `codex login status` shows whether it is signed in.
3. Create `~/.codex/claude.config.toml`:

   ```toml
   model = "gpt-6.1-sol"
   model_reasoning_effort = "xhigh"
   ```

The skill's commands set the sandbox themselves, so the profile needs no `sandbox_mode`.
