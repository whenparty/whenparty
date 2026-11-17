# P2P

`p2p/` is the p2p [module](/docs/glossary.md#module) of the [platform](../AGENTS.md), which [calisthenics](../../titles/calisthenics/AGENTS.md) plays through. It also holds the headers that the dev and preview servers of every title send ([workspace.md](../../docs/workspace.md#running-a-title-locally)). It has no specification.

- [docs/session.md](docs/session.md): the session rules: where the session's code lives, the phases, which snapshots a tab takes, absence and what a game sees of the room. Read it before changing `src/`.
- [docs/verification.md](docs/verification.md): which file a new test of the session goes in, and the controlled clock.
