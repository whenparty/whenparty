# Rooms on the server

- `10-1` When the rooms server restarts, such as for a deploy, every room is gone, and the server tells no page.
- `10-2` A room on the rooms server goes through these states. It is created as [12-1](12-server-answers.md) says.
  ```mermaid
  stateDiagram-v2
    [*] --> owned: created
    owned --> away: owner connection closes (10-5)
    away --> owned: reconnect or return (10-6, 10-7)
    owned --> owned: reconnect or return (10-6, 10-7)
    owned --> [*]: closes (10-3)
    away --> [*]: closes (10-3)
  ```
- `10-3` A room closes when the owner's leave arrives (10-8), when the waiting time has passed since it last had an owner connection, when for 600 seconds it has had neither an owner connection nor a participant in the member state ([11-1](11-server-participants.md)), or when 24 hours have passed since it was created. When it closes, the server cancels its tokens and ends its pending join requests ([11-4](11-server-participants.md)), and its code may go to a new room. When it closes after 24 hours, the server tells the owner connection, when it has one, that it closed the room.
- `10-4` When the server creates a room, the room's term is 1, the signaling connection of the request becomes the owner connection, and the page that asked is the room's owner's page.
- `10-5` The owner connection is the signaling connection from which the room was created, until a reconnect (10-6) or a return of the owner (10-7) makes another one the owner connection. The server takes the answers to join requests and the leaves that the owner's page reports only from the owner connection, and drops them from any other. It handles every message of the owner connection before it learns that the connection closed ([2-3](../../../transport/docs/specs/2-server-parts.md)), and then the room has no owner connection.
- `10-6` Each owner's page makes an identifier of its own when it starts and sends it with its requests to create, reconnect and return, so a page that starts anew has another one; by it the server tells which page asks. The server answers a request to reconnect ([4-5](4-owner.md)) with the first row of this table that applies:
  | When                                                             | Answer                                                                                                                                                                             |
  | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | no open room of the app ID has the code                          | "no room"                                                                                                                                                                          |
  | the token is not the room owner's                                | "removed"                                                                                                                                                                          |
  | the request comes from another page than the room's owner's page | none: the server drops the request                                                                                                                                                 |
  | otherwise                                                        | the server applies the leaves of the request, makes the request's connection the owner connection and answers with the roster: the numbers of the participants in the member state |
- `10-7` A return with the owner's token ([12-3](12-server-answers.md)) is a return of the owner, and the server tells its page by the identifier of 10-6. The server answers it with the first row of this table that applies:

  | When                                           | Answer                                                                                       |
  | ---------------------------------------------- | -------------------------------------------------------------------------------------------- |
  | the request comes from the room's owner's page | the term stays                                                                               |
  | the term of the request is the room's term     | the server raises the term by 1, and the page of the request becomes the room's owner's page |
  | otherwise                                      | the room's term; nothing changes                                                             |

  In the first two rows, the server first applies the leaves of the request, then makes the request's connection the owner connection and answers with the term and the roster, as 10-6 says.

- `10-8` The server handles the requests of one signaling connection in the order they arrive ([2-1](../../../transport/docs/specs/2-server-parts.md)). It takes a leave with a token from any signaling connection and sends no answer to it: a leave with the owner's token closes the room, and a leave with a participant's token cancels that token ([11-7](11-server-participants.md)).
- `10-9` The server drops a request that it cannot read, such as one that is not in the form that the rooms module sends, one with a number or term outside the range of [1-5](1-room.md), or a join request whose join data is not join data ([1-15](1-room.md)).
