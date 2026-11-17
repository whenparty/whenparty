# Signaling connections

- `1-1` The transport has a part on each page and a part in the transport server, which runs in the signaling deployment in [`games/platform/signaling/`](../../../signaling/AGENTS.md). A page opens a signaling connection to the transport server for one or more [modules](/docs/glossary.md#module) that use the transport, which it names. Each of them gets a channel on the connection, between its part on the page and its part in the transport server, called its server part. A signaling connection goes through the states of this diagram:
  ```mermaid
  stateDiagram-v2
    [*] --> opening
    opening --> open: peer ID (1-3)
    opening --> closed: outdated (1-2)
    opening --> closed: offline (1-4, 1-5)
    open --> closed: offline (1-5, 1-6)
    opening --> closed: the page closes it (1-8)
    open --> closed: the page closes it (1-8)
  ```
- `1-2` When it opens a signaling connection, the page names the version of the transport's protocol and the version of the protocol of each module that it names. When the transport server refuses them ([7-1](7-server.md)), the connection closes with `outdated`, which names the side whose version is older: the page or the server.
- `1-3` When the transport server accepts the versions, it gives the connection a peer ID: 22 base64url characters that carry 128 random bits. The connection is open when the page has its peer ID, and the transport then tells each module on its channels the peer ID. Each signaling connection gets a new peer ID.
- `1-4` When the page has no peer ID 10 seconds after it began to open the connection, the connection closes with `offline`.
- `1-5` When the browser reports that the WebSocket connection closed, whether the transport server, the network or the browser closed it, the signaling connection closes with `offline`.
- `1-6` While the connection is opening or open, the page answers each check of the transport server ([7-2](7-server.md)) at once, also while the browser slows its timers. When nothing has arrived on an open connection for 45 seconds, the page closes it with `offline`.
- `1-7` The page measures every time limit of the transport by a clock that keeps running while its device sleeps. What the page does at once, or when a time limit passes, it does the first time its scripts run at or after that moment. When its scripts resume after they were suspended or the device slept, the page first checks every time limit by that clock, before it handles what arrived in the meantime.
- `1-8` The page can close a signaling connection that is opening or open, and no module is told of it. Closing a closed one does nothing. When the page unloads or enters the back/forward cache, it closes each of its signaling connections.
- `1-9` When a signaling connection closes other than because the page closed it, the transport tells each module on its channels once, with the reason, as soon as it decides to close it, without waiting for the WebSocket connection to close. From a closed signaling connection, the transport delivers nothing more.
- `1-10` A module message is a JSON value: null, true, false, a finite number, a string, or an array or object of these, of at most 16,384 bytes as UTF-8 JSON without whitespace outside strings, and with no lone surrogates in its strings. When a module sends another value, or sends on a signaling connection that is not open, sending fails and nothing is sent. The transport sends a module message as it was when the module sent it.
- `1-11` While a signaling connection is open, module messages and the transport's own messages arrive once and in the order sent, across all channels together, in each direction. What has not arrived when the connection closes is lost. The page does not limit how fast it sends; the transport server reads it at the pace of [7-3](7-server.md).
- `1-12` The transport does not wait for a promise that a handler of a module returns, and ignores its rejection. When a module's handler of a module message, or of a notice about a signaling connection, throws, the message or notice counts as delivered, and the transport goes on.
- `1-13` A signaling connection is one WebSocket connection to the transport server, which accepts it at the path `/platform`: a page whose host is `localhost` or `127.0.0.1` connects to `ws://localhost:8080/platform`, and any other page to `wss://signaling.when.party/platform`.
- `1-14` A closed signaling connection does not open again, and the page does not open another one by itself.
- `1-15` The notice that a signaling connection closed (1-9) gives the moment, by the clock of 1-7, when the last message arrived on the connection, checks of the transport server included, or the moment the page began to open it when none did.
- `1-16` When the page closes a signaling connection, it closes the WebSocket connection so that the browser first sends what the page has already sent on it. Those messages may still not arrive.
