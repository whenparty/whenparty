# Calisthenics

`calisthenics/` is the street workout championship game of [titles](../AGENTS.md). It plays through the [p2p module](../../platform/p2p/AGENTS.md) of the platform and is one [deployment](/docs/glossary.md#deployment).

- [docs/specs/](docs/specs/): the specification. [1-preparation.md](docs/specs/1-preparation.md) holds the athletes' characteristics and plans, [2-scoring.md](docs/specs/2-scoring.md) the challenges and scores, [3-match.md](docs/specs/3-match.md) the lobby, the screens of a challenge, the turns of its results and the pauses while a player is away, [4-presentation.md](docs/specs/4-presentation.md) the two interfaces, the athletes' looks, the podium, the page without WebGL and reduced motion, and [5-movements.md](docs/specs/5-movements.md) the demonstrations, attempts, apparatus, reactions and replays of the 3D interface.
- [docs/architecture.md](docs/architecture.md): what `src/core/`, `src/connection.ts`, the frontends and the 3D assets hold, and what each may import. Read it before changing code or 3D assets in `src/`.
- [docs/verification.md](docs/verification.md): the commands that test, typecheck, build and format the game, what the tests check, what to check by hand in a browser and how to run the game locally.
