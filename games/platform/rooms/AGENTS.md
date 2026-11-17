# Rooms

`rooms/` is the rooms [module](/docs/glossary.md#module) of the [platform](../AGENTS.md), on the [transport module](../transport/AGENTS.md). It gathers the pages of participants into rooms, asks the owner's app whom to let in, and tells each app who is present and when its room ends. The package `@whenparty/rooms` holds its page part in `src/` and, in `src/server/`, the rooms server: its [server part](../transport/docs/specs/1-signaling.md) in the transport server, which runs in the [signaling deployment](../signaling/AGENTS.md).

- [docs/specs/](docs/specs/): its specification. Files 1 to 9 hold what the app on a page gets: rooms, joining, a participant's and the owner's pages, presence, texts, leaving, and the tab lock and record. Files 10 to 12 hold the rooms server: rooms, participants and its answers.
- [room-storage.md](../docs/decisions/room-storage.md): why the rooms server keeps rooms only in memory, and so why a restart of the signaling deployment ends every room.
- [layers.md](../docs/decisions/layers.md): why transport, rooms and netcode are modules of their own and why the deployments that run the servers are not modules. Read it before moving code or rules between the modules.
- [hosting.md](../../titles/docs/hosting.md): the prefix of the keys that the module stores in the browser.
