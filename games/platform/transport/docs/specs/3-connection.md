# Peer connections

- `3-1` A [module](/docs/glossary.md#module) connects to another page over a signaling connection of its own page, called the peer connection's own signaling connection, by the peer ID of the other page's signaling connection. Each time a module connects, the transport starts a peer connection of its own, with a random identifier: two pages may have several, and the signals and closing of one touch no other. The calling page sends the transport server a call, its request to connect the two pages. The attempt of a peer connection lasts from its start until it opens or closes. Each side of a peer connection goes through the states of this diagram:
  ```mermaid
  stateDiagram-v2
    [*] --> connecting: connects (3-1), call arrives (3-3)
    connecting --> channel: channel opens (3-6)
    channel --> open: ready arrives (3-7)
    connecting --> closed: offline, peer offline, no peer, busy, failed
    connecting --> closed: timeout, no relay, too small, closed
    channel --> closed: timeout, failed, too small, closed
    open --> closed: broken (4-8), closed (4-7)
    connecting --> closed: closed by the module or page (3-12)
    channel --> closed: closed by the module or page (3-12)
    open --> closed: closed by the module or page (3-12)
  ```
- `3-2` When a module connects over a signaling connection that is not open, the peer connection closes at once with `offline`. When the transport server rejects the call ([6-1](6-calls.md)), the calling side closes with the server's reason: `no peer`, `busy` or `failed`.
- `3-3` When a call reaches the called page, the transport there starts the called side in `connecting` and tells the module that set the signaling connection's handler of incoming peer connections, with the caller's peer ID. A signaling connection has at most one such handler, and setting a second one fails. When no module has set it, or the handler throws, the called side closes without telling any module.
- `3-4` Before each attempt, outgoing or incoming, the page asks the transport server for new TURN credentials ([8-1](8-turn.md)) and waits for the answer while the deadline of 3-5 runs. It uses them for this attempt only. When the answer is empty, the attempt goes on without TURN.
- `3-5` The calling side's deadline is 15 seconds after the module connected. The called side's deadline is the moment the call reached its page plus the time that came with the call ([6-4](6-calls.md)). Each side counts its deadline by its clock ([1-7](1-signaling.md)). When its deadline passes before the side is open, also when the other side's ready has arrived but has not been handled, the side closes with the reason of 3-9.
- `3-6` When the reliable and ordered data channel of the attempt opens on a side, the side checks that it can send the largest text ([4-1](4-delivery.md)) within its browser's limit and the other side's, as its browser reports them, counting a limit that its browser does not report as large enough. When it cannot, the side closes with `too small`. When it can, the side is in `channel` and sends ready on the channel.
- `3-7` When the other side's ready arrives at a side in `channel`, the side is open.
- `3-8` While a side is in `connecting`, it closes with `offline` when its own signaling connection closes, and with `peer offline` when the transport server says that the signaling connection of the other page closed ([6-6](6-calls.md)). While a side is in `channel` or `open`, the closing of its own signaling connection changes nothing, and it drops what the server says about the other page's.
- `3-9` When, while a side is in `connecting` or `channel`, its browser reports that the connection failed or closed, its channel closes without a closing message, or its browser fails to send, the side closes at once. The reason, then and at the deadline of 3-5, is `no relay` when all of these hold: the side is in `connecting`, it has no relay candidate, the other side's description has arrived, and its browser reported that coturn had no free allocation for it, with error 486 or 508. Otherwise it is `timeout`.
- `3-10` When, before a side is open, its browser rejects the other side's description or one of its candidates, or the transport server says that the attempt closed with `failed` ([6-5](6-calls.md)), the side closes with `failed`. An open side drops a candidate that its browser rejects, and the server's word that the attempt closed with `failed`.
- `3-11` A closed side drops everything that arrives, and nothing that happens changes it.
- `3-12` The module can close its side in any state, and closing a closed side does nothing. When the page unloads or enters the back/forward cache, it closes each of its peer connections as if the module closed it.
- `3-14` The transport tells the module once when its side opens, with the path and the round-trip time ([4-6](4-delivery.md)), and once when it closes, with the reason, unless the module or the page closed it. When the module's handler of either notice throws, the transport goes on.
- `3-15` The notice that a side closed (3-14) gives the moment, by the clock of [1-7](1-signaling.md), when the last message arrived on its channel, the transport's own included, or the moment its attempt started when none did.
