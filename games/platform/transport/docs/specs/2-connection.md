# Peer connections

- `2-1` A page connects to another page by the peer ID of that page's signaling connection ([1-1](1-signaling.md)), and the transport tells the other page of the incoming connection with the peer ID of the page that connected. The other page accepts or refuses it. A peer connection goes through the states of this diagram, and the transport tells each side once each time its side enters `open`, `reconnecting` or `closed`, except the side that closed it:
  ```mermaid
  stateDiagram-v2
    [*] --> connecting
    connecting --> open: opens (2-3)
    connecting --> closed: fails (2-2, 2-3)
    open --> reconnecting: breaks (2-5, 2-6)
    reconnecting --> open: an attempt opens (2-7)
    reconnecting --> closed: a signaling connection closes (2-7)
    open --> closed: a side closes it (2-8)
    reconnecting --> closed: a side closes it (2-8)
  ```
- `2-2` When the page that connects has no open signaling connection, connecting fails at once. When no open signaling connection has the peer ID, or the other page refuses the incoming connection, the peer connection closes on the side that connected.
- `2-3` A peer connection opens when its WebRTC data channel opens with reliable and ordered delivery and both browsers can carry messages of 65,536 bytes. When either browser can carry less, the peer connection closes. When it has not opened 15 seconds after the page connected, it closes on that side, and on the other side 15 seconds after the transport told that page of it.
- `2-4` While a peer connection is open on both sides, each message, a text, arrives at the other side once and in the order sent. Messages that have not arrived when the connection breaks or closes are lost, and messages of an earlier attempt never arrive after it opens again.
- `2-5` Sending a text over 65,536 bytes of UTF-8, or sending while the sender's side is not `open`, fails, and nothing is sent. When the browser fails to send a text, such as when its send queue is full, the peer connection breaks on that side.
- `2-6` While a peer connection is open, each side sends a check every 5 seconds. When a side has got nothing from the other for 15 seconds, the connection breaks on that side. It also breaks when the browser reports the WebRTC connection failed or closed; a report that it is disconnected does not break it. Each side finds a break on its own.
- `2-7` When a peer connection breaks, the page that connected starts a new attempt through the signaling server at once, and again each time an attempt has not opened 15 seconds after it started. The other page takes each new attempt without being told of it. The peer connection closes when the signaling connection of either page closes while it is `reconnecting`; the transport server tells the other page of that.
- `2-8` When a page closes a peer connection, its side closes at once and sends nothing more. The other side closes when it learns of it through the peer connection or the signaling server; when it learns of it from neither, it breaks as 2-6 says.
- `2-9` When a peer connection opens, and whenever its path changes between direct and through the TURN server, the transport tells each side the path and the latest round-trip time in milliseconds. It finds a change within 5 seconds.
