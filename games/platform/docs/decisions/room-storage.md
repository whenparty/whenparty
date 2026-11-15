# Room storage

## Context

The rooms server, the server part of the [rooms module](../../rooms/AGENTS.md), runs in the transport server in the [signaling deployment](../../signaling/AGENTS.md), as [layers.md](layers.md) decides. That deployment restarts on every deploy, which follows every change that reaches it, as [games-changes.md](/.github/docs/games-changes.md) says, changes to the rooms and transport packages included. Creating a room, joining it and returning to it after a break need the rooms server. The relay of the p2p module keeps no rooms, so a game played through p2p outlives a restart.

## Options

- Rooms only in the memory of the rooms server. A restart ends every room, and with it every game played through netcode. Nothing to store, sign or restore.
- After a restart, the owner's page restores its room with the same code, tokens, term and roster. The server signs tokens with a secret of its own, so that after a restart it restores a room only for the page that holds the owner's token. Games outlive a restart, at the cost of one more secret in the environment of the signaling deployment, signing and checking tokens, and a restore to specify and test.
- Rooms on disk or in a database such as Redis. Games outlive a restart, at the cost of storage or another service to run beside the signaling deployment.

## Decision

Rooms only in memory. A restart costs the games that run at that moment, whose players start a new room. Each other option adds a secret or a service to the first version of the rooms server, and a restore with failures of its own to specify and test.

## Consequences

- The rooms specification: [10-1](../../rooms/docs/specs/10-server-room.md).
- [signaling/AGENTS.md](../../signaling/AGENTS.md) says that a deploy ends every room.
