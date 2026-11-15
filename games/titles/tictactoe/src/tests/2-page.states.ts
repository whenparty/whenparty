type State = "loading" | "lobby" | "room" | "roomOver"

type Event =
  | "opensWithCode"
  | "opensWithoutCode"
  | "startPressed"
  | "formCode"
  | "formNotCode"
  | "addressOtherCode"
  | "addressSameCode"
  | "addressNotCode"
  | "leavePressed"
  | "startingOrEnteringFails"
  | "gameEnds"
  | "codeTold"
  | "copyPressed"
  | "snapshotTaken"
  | "cellClickMoves"
  | "cellClickOther"
  | "moveRefused"
  | "hostPageFirstMatchReady"
  | "hostPageNextMatchReady"
  | "startNextPressed"
  | "cannotStart"
  | "matchWon"
  | "nextMatchStarts"
  | "joinRequest"
  | "requestAnswered"
  | "requestEnded"

type Outcome = {
  readonly next: State
  readonly netcode?: "start a game" | "enter the game of the code" | "leave, then enter the game of the new code" | "leave" | "act" | "start a match" | "answer the request"
  readonly shows?: string
  readonly address?: "the code in the netcode's form, replacing the history entry" | "no code"
}

type Cell<O> = { readonly ids: readonly string[]; readonly outcome: O } | { readonly impossible: string }

const notOpenYet = { impossible: "the page has not opened yet" } as const
const alreadyOpen = { impossible: "the page opened already; a reload or a return from the back/forward cache opens a new page" } as const
const noGame = { impossible: "no game goes on, so the netcode tells the page nothing" } as const
const noRoomView = { impossible: "the lobby has no leave button, copy button, board, start button or requests (2-1)" } as const
const noLobbyControls = { impossible: "the room view has no start button and no form (2-3)" } as const
const afterEnd = { impossible: "after starting or entering failed or the game ended, the netcode tells the page nothing more" } as const
const goneAfterEnd = { impossible: "after the end, the room view shows neither the button of 2-9 nor requests (2-11)" } as const

const loadingRow = {
  startPressed: notOpenYet,
  formCode: notOpenYet,
  formNotCode: notOpenYet,
  addressOtherCode: notOpenYet,
  addressSameCode: notOpenYet,
  addressNotCode: notOpenYet,
  leavePressed: notOpenYet,
  startingOrEnteringFails: notOpenYet,
  gameEnds: notOpenYet,
  codeTold: notOpenYet,
  copyPressed: notOpenYet,
  snapshotTaken: notOpenYet,
  cellClickMoves: notOpenYet,
  cellClickOther: notOpenYet,
  moveRefused: notOpenYet,
  hostPageFirstMatchReady: notOpenYet,
  hostPageNextMatchReady: notOpenYet,
  startNextPressed: notOpenYet,
  cannotStart: notOpenYet,
  matchWon: notOpenYet,
  nextMatchStarts: notOpenYet,
  joinRequest: notOpenYet,
  requestAnswered: notOpenYet,
  requestEnded: notOpenYet,
} as const

export const table: { readonly [S in State]: { readonly [E in Event]: Cell<Outcome> } } = {
  loading: {
    opensWithCode: { ids: ["2-4", "2-3"], outcome: { next: "room", netcode: "enter the game of the code", shows: "the room view with the code and an empty board", address: "the code in the netcode's form, replacing the history entry" } },
    opensWithoutCode: { ids: ["2-1"], outcome: { next: "lobby", shows: "the lobby" } },
    ...loadingRow,
  },
  lobby: {
    opensWithCode: alreadyOpen,
    opensWithoutCode: alreadyOpen,
    startPressed: { ids: ["2-3"], outcome: { next: "room", netcode: "start a game", shows: "the room view with an empty board" } },
    formCode: { ids: ["2-2", "2-3"], outcome: { next: "room", netcode: "enter the game of the code", shows: "the room view with the code and an empty board", address: "the code in the netcode's form, replacing the history entry" } },
    formNotCode: { ids: ["2-2"], outcome: { next: "lobby", shows: "That is not a room code. Codes have 5 characters, like K7MXQ." } },
    addressOtherCode: { ids: ["2-5", "2-3"], outcome: { next: "room", netcode: "enter the game of the code", shows: "the room view with the code and an empty board", address: "the code in the netcode's form, replacing the history entry" } },
    addressSameCode: { impossible: "the lobby has no game whose code the address could name" },
    addressNotCode: { ids: ["2-5"], outcome: { next: "lobby", shows: "the lobby" } },
    leavePressed: noRoomView,
    startingOrEnteringFails: noGame,
    gameEnds: noGame,
    codeTold: noGame,
    copyPressed: noRoomView,
    snapshotTaken: noGame,
    cellClickMoves: noRoomView,
    cellClickOther: noRoomView,
    moveRefused: noGame,
    hostPageFirstMatchReady: noGame,
    hostPageNextMatchReady: noGame,
    startNextPressed: noRoomView,
    cannotStart: noGame,
    matchWon: noGame,
    nextMatchStarts: noGame,
    joinRequest: noGame,
    requestAnswered: noRoomView,
    requestEnded: noGame,
  },
  room: {
    opensWithCode: alreadyOpen,
    opensWithoutCode: alreadyOpen,
    startPressed: noLobbyControls,
    formCode: noLobbyControls,
    formNotCode: noLobbyControls,
    addressOtherCode: { ids: ["2-5", "2-3"], outcome: { next: "room", netcode: "leave, then enter the game of the new code", shows: "the room view with the new code and an empty board", address: "the code in the netcode's form, replacing the history entry" } },
    addressSameCode: { ids: ["2-5", "2-3"], outcome: { next: "room", address: "the code in the netcode's form, replacing the history entry" } },
    addressNotCode: { ids: ["2-5"], outcome: { next: "lobby", netcode: "leave", shows: "the lobby" } },
    leavePressed: { ids: ["2-6"], outcome: { next: "lobby", netcode: "leave", shows: "the lobby", address: "no code" } },
    startingOrEnteringFails: { ids: ["2-11"], outcome: { next: "roomOver", shows: "the room view without the next-match button and requests" } },
    gameEnds: { ids: ["2-11"], outcome: { next: "roomOver", shows: "the room view without the next-match button and requests" } },
    codeTold: { ids: ["2-3"], outcome: { next: "room", shows: "the code and the copy button", address: "the code in the netcode's form, replacing the history entry" } },
    copyPressed: { ids: ["2-3"], outcome: { next: "room", shows: "the invite link is copied" } },
    snapshotTaken: { ids: ["2-3"], outcome: { next: "room", shows: "the board with the marks of that snapshot" } },
    cellClickMoves: { ids: ["2-8"], outcome: { next: "room", netcode: "act" } },
    cellClickOther: { ids: ["2-8"], outcome: { next: "room" } },
    moveRefused: { ids: ["2-8"], outcome: { next: "room" } },
    hostPageFirstMatchReady: { ids: ["2-9"], outcome: { next: "room", netcode: "start a match" } },
    hostPageNextMatchReady: { ids: ["2-9"], outcome: { next: "room", shows: "the button that starts the next match" } },
    startNextPressed: { ids: ["2-9"], outcome: { next: "room", netcode: "start a match" } },
    cannotStart: { ids: ["2-9"], outcome: { next: "room" } },
    matchWon: { ids: ["2-7"], outcome: { next: "room", shows: "the winning cells in their own colour" } },
    nextMatchStarts: { ids: ["2-7"], outcome: { next: "room", shows: "no cell in the winning colour" } },
    joinRequest: { ids: ["2-10"], outcome: { next: "room", shows: "A player wants to join., with Let in and Refuse" } },
    requestAnswered: { ids: ["2-10"], outcome: { next: "room", netcode: "answer the request", shows: "the request no more" } },
    requestEnded: { ids: ["2-10"], outcome: { next: "room", shows: "the request no more" } },
  },
  roomOver: {
    opensWithCode: alreadyOpen,
    opensWithoutCode: alreadyOpen,
    startPressed: noLobbyControls,
    formCode: noLobbyControls,
    formNotCode: noLobbyControls,
    addressOtherCode: { ids: ["2-11", "2-5", "2-3"], outcome: { next: "room", netcode: "enter the game of the code", shows: "the room view with the new code and an empty board", address: "the code in the netcode's form, replacing the history entry" } },
    addressSameCode: { ids: ["2-11", "2-5", "2-3"], outcome: { next: "roomOver", address: "the code in the netcode's form, replacing the history entry" } },
    addressNotCode: { ids: ["2-11", "2-5"], outcome: { next: "lobby", shows: "the lobby" } },
    leavePressed: { ids: ["2-11", "2-6"], outcome: { next: "lobby", shows: "the lobby", address: "no code" } },
    startingOrEnteringFails: afterEnd,
    gameEnds: afterEnd,
    codeTold: afterEnd,
    copyPressed: { ids: ["2-11", "2-3"], outcome: { next: "roomOver", shows: "the invite link is copied" } },
    snapshotTaken: afterEnd,
    cellClickMoves: { impossible: "a page cannot act after its game ended or failed" },
    cellClickOther: { ids: ["2-8"], outcome: { next: "roomOver" } },
    moveRefused: afterEnd,
    hostPageFirstMatchReady: afterEnd,
    hostPageNextMatchReady: afterEnd,
    startNextPressed: goneAfterEnd,
    cannotStart: afterEnd,
    matchWon: afterEnd,
    nextMatchStarts: afterEnd,
    joinRequest: afterEnd,
    requestAnswered: goneAfterEnd,
    requestEnded: afterEnd,
  },
}
