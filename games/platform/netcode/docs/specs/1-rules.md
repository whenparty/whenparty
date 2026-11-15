# Title rules

- `1-1` A title gives the netcode an app ID and a waiting time, which the netcode passes to the rooms module ([1-2](../../../rooms/docs/specs/1-room.md) and [1-6](../../../rooms/docs/specs/1-room.md)); a format version, an integer from 1 to 1,000,000; and its rules, the functions in this table. A random number is an integer from 0 to 2³² − 1 that the netcode draws anew for each call, and the context is that of 1-2.
  | Rule | Required | Gets | Returns | Called on |
  | --- | --- | --- | --- | --- |
  | seats | yes | nothing | the names of 1 to 12 seats, in their order: distinct strings of 1 to 16 Unicode code points each, without lone surrogates | every page |
  | initial state | yes | a random number and the context | the state of a new match | the host's page |
  | step | yes | a state, a seat, an action, a random number and the context | the next state, or null to refuse the action | the host's page |
  | over | yes | a state | whether its match is over | the host's page |
  | is action | yes | a value | whether it has the form of an action | every page |
  | is state | yes | a value | whether it has the form of a state | every page |
  | presence | no | a state, a seat, a presence event ("lost", "back", "hidden", "visible" or "left") and the context | the next state | the host's page |
  | deadlines | no | a state | up to 64 room times ([6-1](6-time.md)) at which the state needs a call of "deadline", in any order and possibly repeated | the host's page |
  | deadline | no | a state, one of the times that "deadlines" returned for it, a random number and the context | the next state | the host's page |
  | admit | no | a public number ([1-5](../../../rooms/docs/specs/1-room.md)) | whether to let that participant in before the first match | the host's page |
  | can start | no | the last state, or null before the first match, and the seats that have players | whether a match may start | the host's page |
- `1-2` The context of a call is the room time and, for each seat, whether a player sits on it, whether that player is lost and whether its page is hidden ([4-8](4-seats.md)). In a call of "presence", the context already shows the event, except that for "left" the player still sits on its seat.
- `1-3` States and actions are JSON values other than null, and a state or an action is at most 61,440 bytes of UTF-8 as compact JSON. The netcode gives each function a copy of its input, so that what the function does to the input changes nothing, and keeps what the function returns as it reads back from JSON, such as NaN as null and without a field whose value is undefined. A value that has no JSON text, such as one with a cycle, has the wrong form. "is state", "is action" and "over" get the value that the netcode keeps, not the one that a function returned, and a snapshot holds that value.
- `1-4` A function fails when it throws, returns a value of another form than 1-1 and 1-3 say, returns a state that fails "is state" or is larger than 1-3 allows, or breaks a limit of [7-3](7-deadlines.md). When "over", "is action", "is state", "admit" or "can start" fails, its answer counts as no. When "initial state", "step", "presence", "deadlines" or "deadline" fails, the netcode tells the host's page "rules error", and the state stays as it was; [5-2](5-matches.md), [5-7](5-matches.md), [5-8](5-matches.md), [7-4](7-deadlines.md) and [8-5](8-actions.md) say what else follows.
- `1-5` The netcode calls "presence" with "visible" or "hidden" also when the context already shows that visibility for the player: after "back" ([5-6](5-matches.md)), when a match starts ([5-3](5-matches.md)) and at the end of recovery ([10-3](10-recovery.md)).
- `1-6` A title's rules are bad when "seats" throws or returns other seats than 1-1 says, a required function is missing, an optional one is given but is not a function, "deadlines" is given without "deadline", or the format version is not as 1-1 says. A title may give "deadline" without "deadlines": the netcode then never calls it. [2-3](2-page.md) and [2-5](2-page.md) say how starting and entering fail with bad rules.
