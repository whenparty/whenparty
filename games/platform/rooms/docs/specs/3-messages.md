# Messages

- `3-1` Each participant other than the owner is connected only to the owner. The controlling page ([5-2](5-pages.md)) of a participant whose join completed sends texts to the owner, and the owner's controlling page sends texts to one such participant or to all of them. The receiver gets each text with the sender's public number.
- `3-2` A text is at most 65,024 bytes of UTF-8. When a page sends a larger text, sends from a page that does not control its participant, or sends to a participant whose join has not completed or who left, sending fails and nothing is sent.
- `3-3` While the peer connection between two pages is open, texts arrive once and in the order sent. Texts that have not arrived when it breaks or closes are lost ([2-4](../../../transport/docs/specs/2-connection.md)).
- `3-4` When the owner's page sends to a participant whose peer connection is not open, nothing is sent to it. Sending to all sends to every participant whose peer connection is open, whatever happens with the others.
- `3-5` Each text of the owner carries the owner's term ([5-5](5-pages.md)). A participant's page drops a text from the owner whose term is lower than the highest term it got from the owner.
- `3-6` A page drops what arrives over a peer connection in a form that the rooms module does not send.
- `3-7` The rooms module tells a participant's page the path and round-trip time of its peer connection to the owner, and the owner's page those of the peer connection of each participant, whenever the transport tells them ([2-9](../../../transport/docs/specs/2-connection.md)).
