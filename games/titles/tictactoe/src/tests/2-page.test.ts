import assert from 'node:assert/strict'
import {test} from 'node:test'
import type {JoinRequestAnswer, SnapshotView} from '@whenparty/netcode'
import type {CopyLabel} from '../page.ts'
import {newGame, type Game, type Mark} from '../tictactoe.ts'
import {copyButton, table} from './2-page.states.ts'
import {pageHarness, view, type PageHarness, type Played} from './fake-page.ts'

type Table = typeof table
type State = keyof Table
type Event = keyof Table[State]
type Outcome = Extract<Table[State][Event], {readonly outcome: unknown}>['outcome']

type CopyTable = typeof copyButton
type CopyState = keyof CopyTable
type CopyEvent = keyof CopyTable[CopyState]
type CopyOutcome = Extract<CopyTable[CopyState][CopyEvent], {readonly outcome: unknown}>['outcome']

const code = 'BCDFG'
const won: Game = {
  ...newGame(),
  board: ['X', 'X', 'X', 'O', 'O', null, null, null, null],
  turn: 'O',
  result: {kind: 'win', mark: 'X', cells: [0, 1, 2]}
}
const drawn: Game = {...newGame(), result: {kind: 'draw'}}

const hostRoom = (h: PageHarness): void => {
  h.page.open()
  h.page.startPressed()
  h.on.code(code)
  h.on.snapshot(view({running: false, match: 0, seats: [1, null], game: null}))
}

const enteredRoom = (h: PageHarness): void => {
  h.page.open()
  h.page.submitted(code)
  h.on.entering()
}

const participantRoom = (h: PageHarness): void => {
  enteredRoom(h)
  h.on.snapshot(view({participant: 2, isHost: false}))
}

const hosts = (state: State): boolean => state !== 'entering' && state !== 'participantRoom'

const seatOf = (state: State): Mark => (hosts(state) ? 'X' : 'O')

const told = (asHost: boolean, played: Played = {}): SnapshotView => view(asHost ? played : {participant: 2, isHost: false, ...played})

const ownTurnSnapshot = (state: State): SnapshotView => told(hosts(state), {number: 2, game: {...newGame(), turn: seatOf(state)}})

const ownTurnBefore = (h: PageHarness, state: State, event: Event): void => {
  if (event === 'canActTold' || event === 'cannotActTold' || event === 'gameEnds' || event === 'moveAnsweredWithProblem') {
    h.on.snapshot(ownTurnSnapshot(state))
  }
  if (event === 'cannotActTold' || event === 'gameEnds' || event === 'moveAnsweredWithProblem') {
    h.on.canAct(true)
  }
}

const setups: {readonly [S in State]: (h: PageHarness, event: Event) => void} = {
  loading: () => {},
  lobby: h => h.page.open(),
  starting: h => {
    h.page.open()
    h.page.startPressed()
  },
  entering: enteredRoom,
  hostRoom: (h, event) => {
    hostRoom(h)
    if (event === 'cannotStart') {
      h.on.snapshot(view({running: false, match: 1, seats: [1, 2], game: won, number: 2}))
      h.page.startNextPressed()
    }
    if (event === 'cellClickOther') {
      h.on.snapshot(view({number: 2, game: {...newGame(), turn: 'O'}}))
    }
    ownTurnBefore(h, 'hostRoom', event)
  },
  participantRoom: (h, event) => {
    if (event === 'seatFreedAfterWin') {
      enteredRoom(h)
      h.on.snapshot(view({participant: 3, isHost: false}))
    } else {
      participantRoom(h)
    }
    ownTurnBefore(h, 'participantRoom', event)
  },
  roomOver: h => {
    hostRoom(h)
    h.on.ended({cause: 'room closed'})
  },
  startFailed: h => {
    h.page.open()
    h.page.startPressed()
    h.on.failed({cause: 'offline'})
  }
}

const request: JoinRequestAnswer & {answers: string[]} = {
  number: 3,
  answers: [],
  letIn() {
    this.answers.push('let in')
  },
  refuse() {
    this.answers.push('refuse')
  }
}

const events: {readonly [E in Event]: (h: PageHarness, state: State) => unknown} = {
  opensWithCode: h => {
    h.hash = 'bc-dfg'
    h.page.open()
  },
  opensWithoutCode: h => h.page.open(),
  startPressed: h => h.page.startPressed(),
  formCode: h => h.page.submitted('bc dfg'),
  formNotCode: h => h.page.submitted('K7MX'),
  addressOtherCode: h => {
    h.hash = 'HJKMN'
    h.page.addressChanged()
  },
  addressSameCode: h => {
    h.hash = 'bcdfg'
    h.page.addressChanged()
  },
  addressNotCode: h => {
    h.hash = 'nope'
    h.page.addressChanged()
  },
  leavePressed: h => h.page.leavePressed(),
  startingOrEnteringFails: h => h.on.failed({cause: 'offline'}),
  gameEnds: h => h.on.ended({cause: 'idle'}),
  codeTold: h => h.on.code(code),
  copyPressed: h => h.page.copyPressed(),
  snapshotTaken: (h, state) =>
    h.on.snapshot(told(hosts(state), {game: {...newGame(), board: ['X', null, null, null, 'O', null, null, null, null], turn: 'X'}})),
  snapshotWithOtherRole: (h, state) =>
    h.on.snapshot(told(!hosts(state), {game: {...newGame(), board: ['X', null, null, null, 'O', null, null, null, null], turn: 'X'}})),
  otherRoleFirstMatchReady: (h, state) => h.on.snapshot(told(!hosts(state), {running: false, match: 0, seats: [1, 2], game: null})),
  otherRoleNextMatchReady: (h, state) => h.on.snapshot(told(!hosts(state), {running: false, match: 1, seats: [1, 2], game: drawn})),
  cellClickMoves: (h, state) => {
    h.on.snapshot(told(hosts(state), {number: 2, game: {...newGame(), turn: seatOf(state)}}))
    h.on.canAct(true)
    h.page.cellClicked(4)
  },
  cellClickOther: (h, state) => {
    if (state === 'hostRoom' || state === 'participantRoom') {
      h.on.canAct(true)
    }
    h.page.cellClicked(4)
  },
  moveRefused: h => h.on.refused?.(1),
  canActTold: h => h.on.canAct(true),
  cannotActTold: h => h.on.canAct(false),
  moveAnsweredWithProblem: h => {
    h.netcode.actAnswer = 'cannot act'
    h.page.cellClicked(4)
  },
  firstMatchReady: (h, state) => h.on.snapshot(told(hosts(state), {running: false, match: 0, seats: [1, 2], game: null})),
  nextMatchReady: (h, state) => h.on.snapshot(told(hosts(state), {running: false, match: 1, seats: [1, 2], game: drawn})),
  seatFreedAfterWin: (h, state) => {
    const watcher = hosts(state) ? {} : {participant: 3}
    h.on.snapshot(told(hosts(state), {...watcher, running: false, match: 1, seats: [1, 2], game: won}))
    h.on.snapshot(told(hosts(state), {...watcher, running: false, match: 1, seats: [1, null], game: won, number: 3}))
  },
  otherRoleMatchWon: (h, state) => h.on.snapshot(told(!hosts(state), {running: false, match: 1, seats: [1, 2], game: won})),
  otherRoleSeatFreeAfterWin: (h, state) => h.on.snapshot(told(!hosts(state), {running: false, match: 1, seats: [1, null], game: won})),
  startNextPressed: (h, state) => {
    h.on.snapshot(told(hosts(state), {running: false, match: 1, seats: [1, 2], game: won}))
    h.page.startNextPressed()
  },
  cannotStart: h => h.on.cannotStart?.(),
  matchWon: (h, state) => h.on.snapshot(told(hosts(state), {running: false, game: won})),
  nextMatchStarts: (h, state) => {
    h.on.snapshot(told(hosts(state), {running: false, game: won}))
    h.on.snapshot(told(hosts(state), {running: true, match: 2, number: 3}))
  },
  joinRequest: h => h.on.joinRequest(request),
  requestAnswered: h => {
    h.on.joinRequest(request)
    h.page.answered(3, true)
  },
  requestEnded: h => {
    h.on.joinRequest(request)
    h.on.requestEnded(3)
  }
}

const netcodeCalls: {readonly [C in NonNullable<Outcome['netcode']>]: (h: PageHarness) => readonly string[]} = {
  'start a game': () => ['start a game'],
  'enter the game of the code': h => [`enter ${h.hash === 'HJKMN' ? 'HJKMN' : code}`],
  'leave, then enter the game of the new code': () => ['leave', 'enter HJKMN'],
  leave: () => ['leave'],
  act: () => [`act ${JSON.stringify({cell: 4, board: [null, null, null, null, null, null, null, null, null]})}`],
  'start a match': () => ['start a match'],
  'answer the request': () => []
}

const entered = (h: PageHarness): string => h.netcode.calls.findLast(call => call.startsWith('enter '))?.slice('enter '.length) ?? ''

const shows: {readonly [S in NonNullable<Outcome['shows']>]: (h: PageHarness) => void} = {
  'the room view with the code and an empty board': h => {
    assert.equal(h.view.screen, 'room')
    assert.equal(h.view.code, entered(h))
    assert.ok(h.view.board.every(cell => cell === null))
  },
  'the lobby': h => assert.equal(h.view.screen, 'lobby'),
  'the room view with "you host" and an empty board': h => {
    assert.equal(h.view.screen, 'room')
    assert.equal(h.view.code, null)
    assert.equal(h.view.hosting, true)
    assert.ok(h.view.board.every(cell => cell === null))
  },
  'That is not a room code. Codes have 5 characters, like K7MXQ.': h =>
    assert.equal(h.view.formError, 'That is not a room code. Codes have 5 characters, like K7MXQ.'),
  'the room view with the new code and an empty board': h => {
    assert.equal(h.view.code, 'HJKMN')
    assert.equal(h.view.hosting, false)
    assert.ok(h.view.board.every(cell => cell === null))
  },
  'the winning cells in their own colour, and no button that starts the next match': h => {
    assert.deepEqual(h.view.winning, [0, 1, 2])
    assert.equal(h.view.nextMatch, false)
  },
  '"you host", the winning cells in their own colour and no button that starts the next match': h => {
    assert.equal(h.view.hosting, true)
    assert.deepEqual(h.view.winning, [0, 1, 2])
    assert.equal(h.view.nextMatch, false)
  },
  'the room view without "you host", the next-match button and requests': h => {
    assert.equal(h.view.screen, 'room')
    assert.equal(h.view.hosting, false)
    assert.equal(h.view.nextMatch, false)
    assert.deepEqual(h.view.requests, [])
  },
  'the code and the copy button': h => assert.equal(h.view.code, code),
  'the invite link is being copied': h => assert.deepEqual(h.copies, [`https://games.when.party/tictactoe/#${code}`]),
  'the board with the marks of that snapshot': h => assert.deepEqual(h.view.board, ['X', null, null, null, 'O', null, null, null, null]),
  '"you host"': h => assert.equal(h.view.hosting, true),
  '"you host", the winning cells in their own colour and the button that starts the next match': h => {
    assert.equal(h.view.hosting, true)
    assert.deepEqual(h.view.winning, [0, 1, 2])
    assert.equal(h.view.nextMatch, true)
  },
  '"you host" and the button that starts the next match': h => {
    assert.equal(h.view.hosting, true)
    assert.equal(h.view.nextMatch, true)
  },
  '"you host" and the board with the marks of that snapshot': h => {
    assert.equal(h.view.hosting, true)
    assert.deepEqual(h.view.board, ['X', null, null, null, 'O', null, null, null, null])
  },
  'the winning cells in their own colour and the button that starts the next match': h => {
    assert.deepEqual(h.view.winning, [0, 1, 2])
    assert.equal(h.view.nextMatch, true)
  },
  'the button that starts the next match': h => assert.equal(h.view.nextMatch, true),
  'no button that starts the next match': h => assert.equal(h.view.nextMatch, false),
  'the winning cells in their own colour': h => assert.deepEqual(h.view.winning, [0, 1, 2]),
  'no cell in the winning colour': h => assert.deepEqual(h.view.winning, []),
  'no cell in the winning colour, and no button that starts the next match': h => {
    assert.deepEqual(h.view.winning, [])
    assert.equal(h.view.nextMatch, false)
  },
  'A player wants to join., with Let in and Refuse': h => assert.deepEqual(h.view.requests, [3]),
  'the request no more': h => assert.deepEqual(h.view.requests, [])
}

const stateOf = (h: PageHarness): State => {
  if (h.page.screen === 'room') {
    if (h.view.hosting) {
      return h.view.code === null ? 'starting' : 'hostRoom'
    }
    return h.tookSnapshot ? 'participantRoom' : 'entering'
  }
  if (h.page.screen === 'roomOver') {
    return h.view.code === null ? 'startFailed' : 'roomOver'
  }
  return h.page.screen
}

const run = async (state: State, event: Event, outcome: Outcome): Promise<void> => {
  request.answers = []
  const h = pageHarness()
  setups[state](h, event)
  assert.equal(state === 'loading' ? 'loading' : stateOf(h), state)
  const calls = h.netcode.calls.length
  const addresses = h.addresses.length
  const views = h.views.length
  const before = h.views.at(-1)
  await events[event](h, state)
  await Promise.resolve()
  assert.equal(stateOf(h), outcome.next)
  const expectedCalls = outcome.netcode === undefined ? [] : netcodeCalls[outcome.netcode](h)
  assert.deepEqual(h.netcode.calls.slice(calls), expectedCalls)
  if (outcome.netcode === 'answer the request') {
    assert.deepEqual(request.answers, ['let in'])
  }
  if (outcome.shows !== undefined) {
    const show = shows[outcome.shows]
    assert.ok(show, `no check of what the page shows: ${outcome.shows}`)
    show(h)
  } else if (event === 'moveRefused' || event === 'cannotStart' || event === 'cellClickOther' || event === 'moveAnsweredWithProblem') {
    assert.deepEqual(h.views.at(-1), before)
    assert.ok(h.views.length >= views)
  }
  const changed = h.addresses.slice(addresses)
  if (outcome.address === "the code in the netcode's form, replacing the history entry") {
    assert.equal(changed.at(-1), event === 'addressOtherCode' ? 'HJKMN' : code)
  } else if (outcome.address === 'no code') {
    assert.deepEqual(changed, [null])
  } else {
    assert.deepEqual(changed, [])
  }
  if (outcome.clickOnEmptyCellOfOwnTurn !== undefined) {
    if (stateOf(h) === 'entering') {
      h.on.snapshot(ownTurnSnapshot('entering'))
    }
    const callsBeforeClick = h.netcode.calls.length
    h.page.cellClicked(4)
    const expected = outcome.clickOnEmptyCellOfOwnTurn === 'makes the move' ? netcodeCalls.act(h) : []
    assert.deepEqual(h.netcode.calls.slice(callsBeforeClick), expected)
  }
}

for (const [state, cells] of Object.entries(table)) {
  for (const [event, cell] of Object.entries(cells)) {
    if ('ids' in cell) {
      test(`${cell.ids.join(' ')} ${state}, ${event}`, () => run(state as State, event as Event, cell.outcome as Outcome))
    }
  }
}

const labels: {readonly [S in CopyState]: CopyLabel} = {copyInviteLink: 'Copy invite link', copied: 'Copied', copyFailed: 'Copy failed'}

const copySetups: {readonly [S in CopyState]: (h: PageHarness) => Promise<void>} = {
  copyInviteLink: async h => hostRoom(h),
  copied: async h => {
    hostRoom(h)
    h.page.copyPressed()
    await h.copyEnds(true)
  },
  copyFailed: async h => {
    hostRoom(h)
    h.page.copyPressed()
    await h.copyEnds(false)
  }
}

const copyEvents: {readonly [E in CopyEvent]: (h: PageHarness) => unknown} = {
  pressed: h => h.page.copyPressed(),
  copySucceeds: async h => {
    h.advance(1000)
    h.page.copyPressed()
    await h.copyEnds(true)
  },
  copyRefused: async h => {
    h.advance(1000)
    h.page.copyPressed()
    await h.copyEnds(false)
  },
  limitPasses: h => h.advance(2000),
  pageRunsAgainAfterLimit: h => {
    h.sleep(60_000)
    h.advance(0)
  },
  snapshotTaken: h => h.on.snapshot(view({number: 5})),
  gameEnds: h => h.on.ended({cause: 'idle'}),
  otherGameOrLobby: h => {
    h.page.leavePressed()
    h.hash = 'HJKMN'
    h.page.addressChanged()
  }
}

const runCopy = async (state: CopyState, event: CopyEvent, outcome: CopyOutcome): Promise<void> => {
  const h = pageHarness()
  await copySetups[state](h)
  assert.equal(h.view.copyLabel, labels[state])
  await copyEvents[event](h)
  assert.equal(h.view.copyLabel, labels[outcome.next])
  if (outcome.limit === '2 seconds from this end') {
    h.advance(1999)
    assert.equal(h.view.copyLabel, labels[outcome.next])
    h.advance(1)
    assert.equal(h.view.copyLabel, 'Copy invite link')
  }
}

for (const [state, cells] of Object.entries(copyButton)) {
  for (const [event, cell] of Object.entries(cells)) {
    if ('ids' in cell) {
      test(`${cell.ids.join(' ')} copy button ${state}, ${event}`, () =>
        runCopy(state as CopyState, event as CopyEvent, cell.outcome as CopyOutcome))
    }
  }
}

test('2-1 2-4 the page reads the part of the address after # percent-decoded, or as it is when it does not decode', () => {
  const encoded = pageHarness('bc%20dfg')
  encoded.page.open()
  assert.deepEqual(encoded.netcode.calls, [`enter ${code}`])
  for (const hash of ['%', '%E0']) {
    const h = pageHarness(hash)
    h.page.open()
    assert.equal(h.view.screen, 'lobby')
  }
})

test('2-5 when the address changes to text that does not decode, the page leaves its game and shows the lobby', () => {
  const h = pageHarness()
  hostRoom(h)
  h.hash = '%E0'
  h.page.addressChanged()
  assert.equal(h.view.screen, 'lobby')
  assert.deepEqual(h.netcode.calls, ['start a game', 'leave'])
})

test('2-2 the lobby shows no form error from before a game that the page entered and left', () => {
  const h = pageHarness()
  h.page.open()
  h.page.submitted('K7MX')
  h.hash = code
  h.page.addressChanged()
  h.page.leavePressed()
  assert.equal(h.view.screen, 'lobby')
  assert.equal(h.view.formError, null)
})

test('2-2 the form tells that empty text is not a room code', () => {
  const h = pageHarness()
  h.page.open()
  h.page.submitted('')
  assert.equal(h.view.formError, 'That is not a room code. Codes have 5 characters, like K7MXQ.')
})

test('2-8 a click makes no move while the page cannot act, its seat is not to move, the match is paused or the cell is taken', () => {
  const h = pageHarness()
  participantRoom(h)
  const oToMove = (number: number, game: Partial<Game>): unknown =>
    h.on.snapshot(view({participant: 2, isHost: false, number, game: {...newGame(), turn: 'O', ...game}}))
  h.on.canAct(true)
  h.page.cellClicked(0)
  oToMove(2, {})
  h.on.canAct(false)
  h.page.cellClicked(0)
  h.on.canAct(true)
  oToMove(3, {away: {X: {lost: true, hiddenSince: null}, O: {lost: false, hiddenSince: null}}})
  h.page.cellClicked(0)
  oToMove(4, {board: ['X', null, null, null, null, null, null, null, null]})
  h.page.cellClicked(0)
  assert.deepEqual(h.netcode.calls, [`enter ${code}`])
  h.page.cellClicked(1)
  assert.deepEqual(h.netcode.calls, [
    `enter ${code}`,
    `act ${JSON.stringify({cell: 1, board: ['X', null, null, null, null, null, null, null, null]})}`
  ])
})

test('2-9 the host page starts no match and shows no next-match button while a seat is free', () => {
  const h = pageHarness()
  hostRoom(h)
  assert.equal(h.view.nextMatch, false)
  h.on.snapshot(view({running: false, match: 1, seats: [1, null], game: won, number: 2}))
  assert.equal(h.view.nextMatch, false)
  assert.deepEqual(h.netcode.calls, ['start a game'])
})

test('2-9 after "cannot start", the host page starts the first match at the next snapshot in which no match has started and both seats have players', () => {
  const h = pageHarness()
  hostRoom(h)
  h.on.snapshot(view({running: false, match: 0, seats: [1, 2], game: null, number: 2}))
  h.on.cannotStart?.()
  h.on.snapshot(view({running: false, match: 0, seats: [1, 2], game: null, number: 3}))
  assert.deepEqual(h.netcode.calls, ['start a game', 'start a match', 'start a match'])
})

test('2-9 a page that does not host starts no match and shows no next-match button', () => {
  const h = pageHarness()
  participantRoom(h)
  h.on.snapshot(view({participant: 2, isHost: false, running: false, match: 0, seats: [1, 2], game: null, number: 2}))
  h.on.snapshot(view({participant: 2, isHost: false, running: false, match: 1, seats: [1, 2], game: won, number: 3}))
  assert.equal(h.view.nextMatch, false)
  assert.deepEqual(h.netcode.calls, [`enter ${code}`])
})

test('2-10 the Refuse button refuses the join request', () => {
  const h = pageHarness()
  hostRoom(h)
  request.answers = []
  h.on.joinRequest(request)
  h.page.answered(3, false)
  assert.deepEqual(request.answers, ['refuse'])
  assert.deepEqual(h.view.requests, [])
})

test('2-9 2-10 after the end the requests and the next-match button are gone', () => {
  const h = pageHarness()
  hostRoom(h)
  h.on.snapshot(view({running: false, match: 1, game: won}))
  h.on.joinRequest(request)
  h.on.ended({cause: 'room closed'})
  assert.equal(h.view.nextMatch, false)
  assert.deepEqual(h.view.requests, [])
})
