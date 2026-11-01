# Required reading before edits

## Context

The [workflow](/docs/conventions/workflow.md) and the [checks](/docs/conventions/workflow-checks.md) require reading documents before a change, and nothing confirms that an agent has read them. Claude Code hooks can add text to the agent's context when a session starts and next to the result of a tool call, and a hook that runs before a tool call can deny it. Claude Code cuts each text a hook adds at 10,000 characters: it saves the text to a file and gives the agent the path and the first 2,000 characters, without asking it to read the file.

The root `AGENTS.md` says to read the three workflow files and the writing rules, four rule files, before any change. Every `AGENTS.md` other than those in `games/` is a map: a paragraph about its folder and a list of its documents, each with what it holds and which files or tasks it covers, as the [folder document rules](/docs/conventions/folder-docs.md) say. A game in `games/titles/` lists the platform packages it uses as `@whenparty/*` dependencies in its `package.json`.

For an edit of `check-games.yml`, the documents the previous decision requires are about 9,500 words; those the hook now requires, about 2,900. For a file in `games/titles/calisthenics/`, they are about 11,000 and 3,300 with the current `games/` files.

The [evaluation](/.claude/hooks/docs/evaluation.md) checks which documents an agent running a realistic task reads in full before its first edit. With the hook requiring only the maps and the four rule files, and `.github/AGENTS.md` as a map, Opus 5.5 ran each of two tasks five times, at $0.56 and $0.79 a run:

| Task | Must reach | Reached | Outcome |
| - | - | - | - |
| Skip Markdown-only changes in `ci.yml` with `paths-ignore` | [ci-checks.md](/docs/decisions/ci-checks.md) | 5/5 | All stopped: the record rejects `paths` filters |
| Change the Node image in `check-games.yml` | `.github/docs/checks.md`, which names the Dockerfiles in `games/` | 5/5 | 3 changed all four files, 2 stopped to ask |

## Options

How the documents reach the agent:

- The full text from one hook. The agent has nothing to do, but a text over 10,000 characters arrives as its beginning and a path.
- The full text in parts from several hook entries. The agent has nothing to do, but every tool call starts that many processes, and the number of parts is fixed while the documents grow.
- The full text in a file, or only the paths, with an instruction to read them. A simple hook, but the text reaches the context only if the agent follows the instruction.
- The paths, and a hook that denies edits until the agent has read the listed documents in full. Reading is enforced at any size. The agent spends a round of reads before its first edit, a file read through Bash does not count, and edits through Bash are not checked.

Which documents the hook requires:

- The previous decision: the root `AGENTS.md` and `README.md`, every Markdown file in the root `docs/`, in the file's deepest folder with an `AGENTS.md` and in the packages it lists, and the documents of the folders on its path. Nothing depends on the agent. The agent reads three times the words, mostly unrelated to the task, and the amount grows with every document.
- The root `AGENTS.md`, the four rule files and the `AGENTS.md` of every folder on the file's path. The agent reaches the rest through the maps. A game's map links the platform maps, but the agent can miss a link.
- The same, and the `AGENTS.md` of each `@whenparty/*` package that the deepest folder with an `AGENTS.md` lists in its `package.json`. One more map for a file in a game. The hook relies on the document names and the `@whenparty/` scope.

## Decision

The hook lists the paths and denies edits until the agent has read them. Unlike the full text, it works at any size, and unlike the paths alone, it does not rely on the agent for the documents that every change needs. The round of reads costs less than an edit made without the rules, and the Bash gaps remain, as they do for the permission rules in the settings.

It requires the root `AGENTS.md`, the four rule files, the maps on the file's path and the maps of its packages. Every change needs the rules, and a map is what the agent needs to choose the rest. In the evaluation on `.github/`, agents then reached the documents each task needs, and the hook requires a third of the words. A package map costs one short file and does not depend on the agent following a link.

## Consequences

- [doc-context.sh](/.claude/hooks/doc-context.sh) and its entries in [settings.json](/.claude/settings.json).
- [doc-context.md](/.claude/hooks/docs/doc-context.md), which describes how the hook works.
