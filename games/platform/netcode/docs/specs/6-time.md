# Room time

- `6-1` Room time is a whole number of milliseconds from 0 to 2⁵³ − 1. A page measures it by the clock of the rooms module ([1-7](../../../rooms/docs/specs/1-room.md)). Time measured so never decreases: when the clock jumps back, it stays until the clock reaches it again, and when the clock jumps forward, it jumps with it.
- `6-2` On the host's page, room time starts at 0 when starting completes ([2-3](2-page.md)). From then, and from the end of recovery after a return by record ([10-1](10-recovery.md)), the host writes room time to its record data ([9-6](9-snapshots.md)) when its page becomes hidden and, while the page's scripts run normally, at least every 5 seconds.
- `6-3` After the host's page returns by record ([10-1](10-recovery.md)), it has no room time until the end of recovery. Then room time goes on from the larger of the room time in the record and that of the recovered snapshot.
- `6-4` On a participant's page, room time is that of the last snapshot the page took plus the time since it took it, without the time during which the netcode told the page "host away" ([3-6](3-entry.md)). Before the page takes its first snapshot, it has no room time.
