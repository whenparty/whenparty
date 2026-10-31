# Required reading before edits

## Context

The [workflow](/docs/conventions/workflow-changes.md) and the [checks](/docs/conventions/workflow-checks.md) require reading documents before a change, and nothing confirms that an agent has read them. Claude Code hooks can add text to the agent's context when a session starts and next to the result of a tool call, and a hook that runs before a tool call can deny it. Claude Code cuts each text a hook adds at 10,000 characters: it saves the text to a file and gives the agent the path and the first 2,000 characters, without asking it to read the file. The root `AGENTS.md`, `README.md` and the Markdown files in `docs/` are together longer than 10,000 characters, and so are the documents of `games/`. Each document alone is shorter. `games/` holds a platform and several games. Each game has its own `AGENTS.md` and specification and lists the platform packages it uses as `@whenparty/*` dependencies in its `package.json`. The root map lists only top-level projects, and a project's `AGENTS.md` lists its subprojects.

## Options

This decision has two parts: how the documents reach the agent, and which documents a file needs.

How the documents reach the agent:

- The previous setup: a reminder after compaction to reread the specifications, with the requirement changes of the branch. Short and simple. Nothing else reaches the agent, and nothing checks the reading.
- The full text from one hook. The agent has nothing to do. Texts longer than 10,000 characters reach the agent as their beginning and a file path.
- The full text in parts from several hooks, each shorter than 10,000 characters. The agent has nothing to do. Each part is its own hook entry on session start and on every tool event, so every tool call starts that many processes, the script is more complex, and the settings fix the number of parts while the documents keep growing.
- The full text in a file that the hook tells the agent to read. One simple hook. The text reaches the context only if the agent follows the instruction.
- Only the paths, with an instruction to read them. The simplest hook. The same reliance on the agent, and one read per document.
- The paths, and a hook that denies edits until the agent has read the listed documents in full. Reading is enforced at any size. The agent spends a round of reads before its first edit, a file read through Bash does not count, and edits through Bash are not checked.

Which documents a file needs, besides the root documents:

- Every Markdown file in the file's top-level folder. No rule to maintain. An edit in one game needs the documents of every other game.
- Every Markdown file of the innermost project that the maps list, which the hook parses from the root [map](/AGENTS.md) and the maps below it. It follows the projects as the documents define them. A change to the format of the map's list breaks it silently, and `.claude/` needs a separate case because the map does not list it as a project.
- The documents of every folder on the file's path, every Markdown file in or below the deepest folder with an `AGENTS.md`, and those of the `@whenparty/*` packages that this folder's `package.json` lists. A file in a game needs its game and the platform code it imports, not other games. A dependency that is not a package, such as a game's use of the signaling server, adds nothing. A file directly in `games/` or `games/titles/` needs the documents of every game. The hook relies on the document names and the `@whenparty/` scope, so a change to them needs a change to the hook.

## Decision

The hook lists the paths and denies edits until the agent has read them. Unlike the full text, it works at any size, and unlike the paths alone, it does not rely on the agent. The round of reads costs less than an edit made without the rules. The Bash gaps remain, as they do for the permission rules in the settings.

A file needs the documents on its path, its deepest folder with an `AGENTS.md` and the packages that folder lists. This follows what the file relies on without a list to maintain. A dependency through the network, such as on the signaling server, goes through a package, whose documents link to it.

## Consequences

- [doc-context.sh](/.claude/hooks/doc-context.sh) and its entries in [settings.json](/.claude/settings.json).
- [.claude/hooks/AGENTS.md](/.claude/hooks/AGENTS.md), which describes how the hook works.
