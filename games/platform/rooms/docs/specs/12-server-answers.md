# Answers of the server

- `12-1` The server answers a request to create a room ([4-2](4-owner.md)) with the first row of this table that applies:
  | When                                                                                                | Answer                                                                                     |
  | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
  | the app ID is not valid ([1-2](1-room.md))                                                          | "bad app"                                                                                  |
  | the waiting time is not valid ([1-6](1-room.md))                                                    | "bad wait"                                                                                 |
  | 10 rooms are open, across all app IDs, or a room created from the same signaling connection is open | "busy"                                                                                     |
  | otherwise                                                                                           | the server creates the room ([10-4](10-server-room.md)) and answers with its code and term |
- `12-2` The server answers a request to join ([2-3](2-join.md)) with the first row of this table that applies:
  | When                                                                                                                                      | Answer                                                                                                             |
  | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
  | the app ID is not valid                                                                                                                   | "bad app"                                                                                                          |
  | no open room of the app ID has the code                                                                                                   | "no room"                                                                                                          |
  | the room has no owner connection                                                                                                          | "owner away"                                                                                                       |
  | 12 participants count in the room, the owner included ([11-2](11-server-participants.md)), or the next number would be over 2,147,483,647 | "full"                                                                                                             |
  | a join request from the same signaling connection waits for the owner ([11-3](11-server-participants.md))                                 | "busy"                                                                                                             |
  | otherwise                                                                                                                                 | the server reserves the next number ([11-2](11-server-participants.md)), asks the owner's page and answers "asked" |
- `12-3` The server answers a request to return ([3-4](3-participant.md)) with the first row of this table that applies:
  | When                                     | Answer                                               |
  | ---------------------------------------- | ---------------------------------------------------- |
  | the app ID is not valid                  | "bad app"                                            |
  | no open room of the app ID has the code  | "no room"                                            |
  | the token is the room owner's            | as a return of the owner ([10-7](10-server-room.md)) |
  | no participant of the room has the token | "removed"                                            |
  | the room has no owner connection         | "owner away"                                         |
  | otherwise                                | as [11-6](11-server-participants.md) says            |
