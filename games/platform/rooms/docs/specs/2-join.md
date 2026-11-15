# Joining

- `2-1` A page that joins a room as a new participant goes through these states until it is in the room ([3-1](3-participant.md)) or joining fails. Before "asking", joining can fail as 2-2, [9-2](9-tab.md) and [9-6](9-tab.md) say, and in any state the app can leave ([8-3](8-ending.md)).
  ```mermaid
  stateDiagram-v2
    [*] --> asking: join (2-3)
    asking --> waiting: owner away (2-4)
    waiting --> asking: 5 s later (2-4)
    asking --> asked: asked (2-3)
    asked --> waiting: owner away (2-6)
    asked --> admitted: let in (2-7)
    admitted --> [*]: in the room (2-8)
    asking --> [*]: fails (2-3, 2-5)
    waiting --> [*]: fails (2-5)
    asked --> [*]: fails (2-5, 2-6)
    admitted --> [*]: fails (2-10, 2-11)
  ```
- `2-2` When the app joins with join data that is not join data ([1-15](1-room.md)), the call fails ([1-14](1-room.md)). Otherwise, when the app joins with an app ID, a text for the code and join data, the page takes the lock. Then, when the app ID is not valid ([1-2](1-room.md)), joining fails with "bad app", and when the text does not make a room code ([1-3](1-room.md)), with "no room", in both cases before the page opens a signaling connection. Otherwise the page goes on as the record decides ([9-5](9-tab.md)).
- `2-3` When the page joins as a new participant ([9-5](9-tab.md)), it asks the rooms server over a signaling connection to join, with the join data. When the answer ([12-2](12-server-answers.md)) is "asked", the app is told "asked"; when it is "owner away", the page waits as 2-4 says; and when it is "no room", "full" or "busy", joining fails with that reason.
- `2-4` When the answer is "owner away", the page waits for the owner: it asks to join again over the same signaling connection 5 seconds later, and again after each "owner away". The app is told that the page waits for the owner once, when the wait starts, and the wait ends with the first other answer. While it waits, the page has no number and does not count in the room.
- `2-5` Until the page is let in, joining fails with "offline" when its signaling connection cannot open ([1-13](1-room.md)) or closes, or when a request gets no answer ([1-12](1-room.md)).
- `2-6` After "asked", the page acts on the final answer ([11-4](11-server-participants.md)): on "let in" as 2-7 says; on "refused" joining fails with "refused", and the app gets the join data of the refusal, if it has any; on "owner away" the page waits as 2-4 says; and on "no room" joining fails with "no room".
- `2-7` When the owner's page lets the participant in, the joining page gets the participant's token and number, the room's waiting time and the peer ID of the owner's page, tells the app that the owner let it in, and connects to the owner's page. It does not write the record before the join completes.
- `2-8` The join completes when the page's peer connection to the owner's page first opens for rooms ([1-8](1-room.md)): the app is told the number, and the page writes the record ([9-4](9-tab.md)) and is in the room.
- `2-9` After the page is let in, each peer connection that it starts to the owner's page is an attempt. When an attempt closes before it opens for rooms, the page asks the rooms server to return with its token ([3-4](3-participant.md)). When the answer gives the owner page's peer ID, the page starts the next attempt to it at once, or 5 seconds after the previous attempt started when that is later. When the answer is "owner away", or the request gets no answer ([1-12](1-room.md)), or its signaling connection cannot open ([1-13](1-room.md)) or closes before the answer, the page asks again 5 seconds later. No attempt starts later than 30 seconds after the page was let in, and the page closes every attempt 45 seconds after the page was let in.
- `2-10` When the join has not completed 45 seconds after the page was let in, or earlier when no attempt is open and none may start, joining fails: with "offline" when the signaling connection for the page's latest return request could not open ([1-13](1-room.md)) or is still opening, and with "unreachable" otherwise. The page then tells the rooms server that it leaves, when its signaling connection is open.
- `2-11` While the page is let in and the join has not completed, joining fails with "no room" when a return gets "no room", and with "unreachable" when a return gets "removed".
