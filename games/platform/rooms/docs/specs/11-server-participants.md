# Participants on the server

- `11-1` A participant on the rooms server goes through these states:
  ```mermaid
  stateDiagram-v2
    [*] --> asked: join request (12-2)
    asked --> member: let in (11-5)
    asked --> [*]: request ends (11-4)
    member --> [*]: token cancelled (11-7)
  ```
- `11-2` A participant counts in the room in the asked and member states. The server reserves the next number, 2, 3 and on, when it asks the owner's page about a join, and never gives a number of the room again.
- `11-3` At most one join request from a signaling connection waits for the owner at a time. The server answers a return at once, and a return never waits for the owner.
- `11-4` A join request ends with the first of these events. The server sends no answer to a withdrawal, and drops an answer of the owner's page to a request that has ended.
  | Event                                                                                  | The joining page gets                        | The owner's page is told |
  | -------------------------------------------------------------------------------------- | -------------------------------------------- | ------------------------ |
  | the owner's page lets the participant in, and the server adds its peer ID as 11-5 says | as 11-5 says                                 | —                        |
  | the owner's page lets the participant in, and the server cannot add its peer ID (11-5) | "owner away"                                 | the request ended        |
  | the owner's page refuses                                                               | "refused", with the join data of the refusal | —                        |
  | 60 seconds pass since the server asked                                                 | "refused"                                    | the request ended        |
  | the joining page withdraws the request, or its signaling connection closes             | —                                            | the request ended        |
  | the owner connection closes, or another connection becomes it                          | "owner away"                                 | —                        |
  | the room closes                                                                        | "no room"                                    | —                        |
- `11-5` When the owner's page lets the participant in, the server adds the joining page's peer ID to the owner connection's list of the peer IDs that may call it ([5-1](../../../transport/docs/specs/5-allow-list.md), [5-2](../../../transport/docs/specs/5-allow-list.md)), names the number and the peer ID to the owner's page, and then gives the joining page the token, the number, the waiting time and the peer ID of the owner's page. The participant is a member from then on, whether or not its peer connection opens.
- `11-6` When the server accepts a participant's return ([12-3](12-server-answers.md)), it adds the returning page's peer ID to the owner connection's list of the peer IDs that may call it ([5-1](../../../transport/docs/specs/5-allow-list.md)), names the number and the peer ID to the owner's page, and only then answers with the peer ID of the owner's page, so the naming arrives before the call ([1-11](../../../transport/docs/specs/1-signaling.md)). When it cannot add the peer ID ([5-2](../../../transport/docs/specs/5-allow-list.md)), it answers "owner away".
- `11-7` The server cancels a participant's token when the participant's leave arrives ([10-8](10-server-room.md)), when the owner's page reports the participant's leave over the owner connection, or when the room closes. When the participant's own leave cancels it, the server tells the owner connection, when the room has one, that the participant left. The server drops a reported leave of a number that is not a member.
- `11-8` The server removes a participant's peer ID from the owner connection's list of the peer IDs that may call it when it cancels the participant's token, and when it names a newer peer ID of the participant.
- `11-9` The server sends a participant's page nothing on its own: it only answers the page's requests to join and to return.
