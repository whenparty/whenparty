type State = "unknown" | "asked" | "player" | "spectator" | "host" | "gone"

type Event =
  | "requestOtherVersion"
  | "requestBadForm"
  | "requestAdmitted"
  | "requestNotAdmitted"
  | "requestAfterFirstMatch"
  | "pageLetsIn"
  | "pageRefuses"
  | "requestEnds"
  | "joinedSeatFree"
  | "joinedNoSeat"
  | "lost"
  | "back"
  | "hidden"
  | "visible"
  | "left"
  | "seatGoesToIt"
  | "startingCompletes"

type Outcome = {
  readonly next: State
  readonly answer?: "let in" | "refuse without data" | "refuse with the host's versions"
  readonly told?: "join request" | "request ended"
  readonly context?: "lost" | "not lost" | "hidden" | "visible"
  readonly seatFreed?: true
  readonly lastAcceptedForgotten?: true
}

type Cell<O> = { readonly ids: readonly string[]; readonly outcome: O } | { readonly impossible: string }

const uniqueNumber = { impossible: "the rooms module asks about each public number once and never gives a number again" } as const
const noRequest = { impossible: "the page was told no join request about this participant" } as const
const notConnected = { impossible: "the rooms module tells presence events about a number only after joined" } as const
const afterLeft = { impossible: "the rooms module tells nothing about a number after left, nor about one that it did not let in" } as const
const notInQueue = { impossible: "only a spectator is in the queue" } as const
const hostOnly = { impossible: "only the host arrives when starting completes" } as const
const ownerNotReported = { impossible: "the host is the room's owner, which the rooms module does not report on, and is never lost" } as const

export const table: { readonly [S in State]: { readonly [E in Event]: Cell<Outcome> } } = {
  unknown: {
    requestOtherVersion: { ids: ["4-1"], outcome: { next: "gone", answer: "refuse with the host's versions" } },
    requestBadForm: { ids: ["4-1"], outcome: { next: "gone", answer: "refuse without data" } },
    requestAdmitted: { ids: ["4-2"], outcome: { next: "unknown", answer: "let in" } },
    requestNotAdmitted: { ids: ["4-2"], outcome: { next: "gone", answer: "refuse without data" } },
    requestAfterFirstMatch: { ids: ["4-3"], outcome: { next: "asked", told: "join request" } },
    pageLetsIn: noRequest,
    pageRefuses: noRequest,
    requestEnds: { ids: ["4-3"], outcome: { next: "unknown" } },
    joinedSeatFree: { ids: ["4-4", "4-8"], outcome: { next: "player", context: "not lost" } },
    joinedNoSeat: { ids: ["4-4", "4-8"], outcome: { next: "spectator", context: "not lost" } },
    lost: notConnected,
    back: notConnected,
    hidden: notConnected,
    visible: notConnected,
    left: { impossible: "the rooms module tells left only after joined" },
    seatGoesToIt: notInQueue,
    startingCompletes: { ids: ["4-4", "4-7"], outcome: { next: "host" } },
  },
  asked: {
    requestOtherVersion: uniqueNumber,
    requestBadForm: uniqueNumber,
    requestAdmitted: uniqueNumber,
    requestNotAdmitted: uniqueNumber,
    requestAfterFirstMatch: uniqueNumber,
    pageLetsIn: { ids: ["4-3"], outcome: { next: "unknown", answer: "let in" } },
    pageRefuses: { ids: ["4-3"], outcome: { next: "gone", answer: "refuse without data" } },
    requestEnds: { ids: ["4-3"], outcome: { next: "gone", told: "request ended" } },
    joinedSeatFree: { impossible: "the rooms module tells joined only after the host let the participant in" },
    joinedNoSeat: { impossible: "the rooms module tells joined only after the host let the participant in" },
    lost: notConnected,
    back: notConnected,
    hidden: notConnected,
    visible: notConnected,
    left: { impossible: "the rooms module tells left only after joined" },
    seatGoesToIt: notInQueue,
    startingCompletes: hostOnly,
  },
  player: {
    requestOtherVersion: uniqueNumber,
    requestBadForm: uniqueNumber,
    requestAdmitted: uniqueNumber,
    requestNotAdmitted: uniqueNumber,
    requestAfterFirstMatch: uniqueNumber,
    pageLetsIn: noRequest,
    pageRefuses: noRequest,
    requestEnds: { ids: ["4-3"], outcome: { next: "player" } },
    joinedSeatFree: { ids: ["4-4"], outcome: { next: "player" } },
    joinedNoSeat: { ids: ["4-4"], outcome: { next: "player" } },
    lost: { ids: ["4-8"], outcome: { next: "player", context: "lost" } },
    back: { ids: ["4-8"], outcome: { next: "player", context: "not lost" } },
    hidden: { ids: ["4-8"], outcome: { next: "player", context: "hidden" } },
    visible: { ids: ["4-8"], outcome: { next: "player", context: "visible" } },
    left: { ids: ["4-6"], outcome: { next: "gone", seatFreed: true, lastAcceptedForgotten: true } },
    seatGoesToIt: notInQueue,
    startingCompletes: hostOnly,
  },
  spectator: {
    requestOtherVersion: uniqueNumber,
    requestBadForm: uniqueNumber,
    requestAdmitted: uniqueNumber,
    requestNotAdmitted: uniqueNumber,
    requestAfterFirstMatch: uniqueNumber,
    pageLetsIn: noRequest,
    pageRefuses: noRequest,
    requestEnds: { ids: ["4-3"], outcome: { next: "spectator" } },
    joinedSeatFree: { ids: ["4-4"], outcome: { next: "spectator" } },
    joinedNoSeat: { ids: ["4-4"], outcome: { next: "spectator" } },
    lost: { ids: ["4-8"], outcome: { next: "spectator", context: "lost" } },
    back: { ids: ["4-8"], outcome: { next: "spectator", context: "not lost" } },
    hidden: { ids: ["4-8"], outcome: { next: "spectator", context: "hidden" } },
    visible: { ids: ["4-8"], outcome: { next: "spectator", context: "visible" } },
    left: { ids: ["4-6"], outcome: { next: "gone", lastAcceptedForgotten: true } },
    seatGoesToIt: { ids: ["4-5"], outcome: { next: "player" } },
    startingCompletes: hostOnly,
  },
  host: {
    requestOtherVersion: uniqueNumber,
    requestBadForm: uniqueNumber,
    requestAdmitted: uniqueNumber,
    requestNotAdmitted: uniqueNumber,
    requestAfterFirstMatch: uniqueNumber,
    pageLetsIn: noRequest,
    pageRefuses: noRequest,
    requestEnds: noRequest,
    joinedSeatFree: ownerNotReported,
    joinedNoSeat: ownerNotReported,
    lost: ownerNotReported,
    back: ownerNotReported,
    hidden: { ids: ["4-8"], outcome: { next: "host", context: "hidden" } },
    visible: { ids: ["4-8"], outcome: { next: "host", context: "visible" } },
    left: ownerNotReported,
    seatGoesToIt: notInQueue,
    startingCompletes: hostOnly,
  },
  gone: {
    requestOtherVersion: uniqueNumber,
    requestBadForm: uniqueNumber,
    requestAdmitted: uniqueNumber,
    requestNotAdmitted: uniqueNumber,
    requestAfterFirstMatch: uniqueNumber,
    pageLetsIn: { ids: ["4-3"], outcome: { next: "gone" } },
    pageRefuses: { ids: ["4-3"], outcome: { next: "gone" } },
    requestEnds: { ids: ["4-3"], outcome: { next: "gone" } },
    joinedSeatFree: afterLeft,
    joinedNoSeat: afterLeft,
    lost: afterLeft,
    back: afterLeft,
    hidden: afterLeft,
    visible: afterLeft,
    left: afterLeft,
    seatGoesToIt: notInQueue,
    startingCompletes: hostOnly,
  },
}
