import assert from 'node:assert/strict'
import {test} from 'node:test'
import {newGame, type Game} from '../tictactoe.ts'
import type {JoinRequestAnswer} from '@whenparty/netcode'
import {rows, rulesErrorNote, serverLostNote} from './3-status.states.ts'
import {pageHarness, view, type PageHarness, type Played} from './fake-page.ts'

const code = 'BCDFG'

const statusAfter = (played: Played): string => {
  const h = pageHarness(code)
  h.page.open()
  h.on.snapshot(view(played))
  return h.view.status
}

const away = (game: Game, mark: 'X' | 'O'): Game => ({...game, away: {...game.away, [mark]: {lost: true, hiddenSince: null}}})

const won: Game = {...newGame(), result: {kind: 'win', mark: 'X', cells: [0, 1, 2]}}
const drawn: Game = {...newGame(), result: {kind: 'draw'}}
const hidden: Game = {...newGame(), result: {kind: 'hidden', seat: 'O'}}
const hiddenX: Game = {...newGame(), result: {kind: 'hidden', seat: 'X'}}
const left: Game = {...newGame(), result: {kind: 'left', seat: 'O'}}
const waitingForPlayer = 'Waiting for a second player. Send them the code.'

const hostPage = (): PageHarness => {
  const h = pageHarness()
  h.page.open()
  h.page.startPressed()
  h.on.code(code)
  h.on.snapshot(view({running: false, match: 0, seats: [1, null], game: null}))
  return h
}

test('3-1 the lost server and a rules error go before the text of the next row', () => {
  const h = hostPage()
  h.on.snapshot(view({running: false, match: 0, seats: [1, 2], game: null, number: 2}))
  h.on.serverLost()
  assert.equal(h.view.status, 'New players cannot join right now: the game server is out of reach. Ready for the next match.')
  h.on.rulesError()
  assert.equal(
    h.view.status,
    'New players cannot join right now: the game server is out of reach. This game has an error. Ready for the next match.'
  )
})

test('3-1 the end of the last match', () => {
  assert.equal(statusAfter({running: false, game: hidden}), 'O was away too long, so the match is over.')
  assert.equal(statusAfter({running: false, game: won, participant: 1}), 'X wins.')
  assert.equal(statusAfter({running: false, game: won, participant: 2, isHost: false}), 'X wins.')
  assert.equal(statusAfter({running: false, game: drawn}), 'Draw.')
})

test('3-1 with a free seat, the status asks for a second player after a win, a draw or a player away too long', () => {
  assert.equal(statusAfter({running: false, game: won, seats: [1, null], participant: 3, isHost: false}), waitingForPlayer)
  assert.equal(statusAfter({running: false, game: drawn, seats: [1, null]}), waitingForPlayer)
  assert.equal(statusAfter({running: false, game: hidden, seats: [1, null]}), waitingForPlayer)
  assert.equal(statusAfter({running: false, game: hiddenX, seats: [1, null]}), waitingForPlayer)
})

test('3-1 with both seats taken after a player was away too long, the status keeps the away text, also for a new player', () => {
  assert.equal(statusAfter({running: false, game: hidden, seats: [1, 2]}), 'O was away too long, so the match is over.')
  assert.equal(
    statusAfter({running: false, game: hidden, seats: [1, 3], participant: 3, isHost: false}),
    'O was away too long, so the match is over.'
  )
  assert.equal(statusAfter({running: false, game: hiddenX, seats: [1, 3]}), 'X was away too long, so the match is over.')
})

test('3-1 a leave shows while its seat is free in the last snapshot', () => {
  assert.equal(statusAfter({running: false, game: left, seats: [1, null]}), 'O left, so the match is over. Send the code to a new player.')
  assert.equal(statusAfter({running: false, game: left, seats: [1, 3]}), 'Ready for the next match.')
})

test('3-1 the status while no match runs', () => {
  assert.equal(statusAfter({running: false, match: 0, game: null, seats: [1, null]}), waitingForPlayer)
  assert.equal(statusAfter({running: false, match: 0, game: null, seats: [1, 2]}), 'Ready for the next match.')
})

test('3-1 the status of a paused match', () => {
  assert.equal(statusAfter({game: away(away(newGame(), 'X'), 'O')}), 'Paused: both players are away.')
  assert.equal(statusAfter({game: away(newGame(), 'O')}), 'Paused: O is away. The match goes on when they are back.')
  const hiddenX: Game = {...newGame(), away: {X: {lost: false, hiddenSince: 5}, O: {lost: false, hiddenSince: null}}}
  assert.equal(statusAfter({game: hiddenX}), 'Paused: X is away. The match goes on when they are back.')
})

test('3-1 the status of a running match', () => {
  assert.equal(statusAfter({participant: 3, seats: [1, 2], isHost: false}), 'You are watching. X to move.')
  assert.equal(statusAfter({participant: 1}), 'Your turn. You are X.')
  assert.equal(statusAfter({participant: 2, isHost: false}), 'You are O. X to move.')
})

type RowTable = typeof rows
type RowState = keyof RowTable
type Event = keyof RowTable[RowState]
type RowOutcome = Extract<RowTable[RowState][Event], {readonly outcome: unknown}>['outcome']
type NoteTable = typeof serverLostNote
type NoteState = keyof NoteTable
type NoteOutcome = Extract<NoteTable[NoteState][Event], {readonly outcome: unknown}>['outcome']

const otherCode = 'HJKMN'
const lostServer = 'New players cannot join right now: the game server is out of reach.'
const gameError = 'This game has an error.'
const hostAlone = view({running: false, match: 0, seats: [1, null], game: null})
const hostPlaying = view({number: 2})
const participantPlaying = view({participant: 2, isHost: false})
const participantNext = view({participant: 2, isHost: false, number: 2, game: {...newGame(), turn: 'O'}})

const request: JoinRequestAnswer = {number: 3, letIn: () => {}, refuse: () => {}}

type Page = {readonly h: PageHarness; last: string; readonly host: boolean}

const lobby = (): Page => {
  const h = pageHarness()
  h.page.open()
  return {h, last: '', host: false}
}

const creating = (): Page => {
  const page = lobby()
  page.h.page.startPressed()
  return {...page, host: true}
}

const entering = (): Page => {
  const h = pageHarness(code)
  h.page.open()
  h.on.entering()
  return {h, last: '', host: false}
}

const waiting = (host: 'decides' | 'offline') => (): Page => {
  const page = entering()
  page.h.on.waiting(host)
  return page
}

const hostPlays = (): Page => {
  const page = creating()
  page.h.on.code(code)
  page.h.on.snapshot(hostAlone)
  page.last = waitingForPlayer
  return page
}

const participantPlays = (): Page => {
  const page = entering()
  page.h.on.snapshot(participantPlaying)
  page.last = 'You are O. X to move.'
  return page
}

const hostAway = (): Page => {
  const page = participantPlays()
  page.h.on.hostAway()
  return page
}

const over = (): Page => {
  const page = hostPlays()
  page.h.on.ended({cause: 'room closed'})
  return page
}

const participantOnly = new Set<Event>(['hostAwayTold', 'hostBackTold', 'waitingDecidesTold', 'waitingOfflineTold', 'enteringTold'])

const unopened = (): Page => ({h: pageHarness(code), last: '', host: false})

const needsCode = new Set<Event>(['addressSameCode', 'copyPressed', 'copyEnds', 'copyLimitPasses'])

const rowSetups: {readonly [S in RowState]: (event: Event) => Page} = {
  none: event => (event === 'opensWithCode' ? unopened() : lobby()),
  creating: event => {
    const page = creating()
    if (needsCode.has(event)) {
      page.h.on.code(code)
    }
    return page
  },
  waitingDecides: waiting('decides'),
  waitingOffline: waiting('offline'),
  entering,
  playing: event => (participantOnly.has(event) ? participantPlays() : hostPlays()),
  hostAway,
  over
}

const fire: {readonly [E in Event]: (page: Page) => unknown} = {
  startPressed: ({h}) => h.page.startPressed(),
  opensWithCode: ({h}) => {
    h.page.open()
    h.on.entering()
  },
  formCode: ({h}) => {
    h.page.submitted(code)
    h.on.entering()
  },
  addressOtherCode: ({h}) => {
    h.hash = otherCode
    h.page.addressChanged()
    h.on.entering()
  },
  addressSameCode: ({h}) => {
    h.hash = code
    h.page.addressChanged()
  },
  leavePressed: ({h}) => h.page.leavePressed(),
  addressNotCode: ({h}) => {
    h.hash = ''
    h.page.addressChanged()
  },
  copyPressed: ({h}) => h.page.copyPressed(),
  copyEnds: async ({h}) => {
    h.page.copyPressed()
    await h.copyEnds(true)
  },
  copyLimitPasses: async ({h}) => {
    h.page.copyPressed()
    await h.copyEnds(true)
    h.advance(2000)
  },
  cellClicked: ({h}) => h.page.cellClicked(4),
  startNextPressed: ({h}) => h.page.startNextPressed(),
  requestAnswered: ({h}) => {
    h.on.joinRequest(request)
    h.page.answered(request.number, true)
  },
  codeTold: ({h}) => h.on.code(code),
  waitingDecidesTold: ({h}) => h.on.waiting('decides'),
  waitingOfflineTold: ({h}) => h.on.waiting('offline'),
  enteringTold: ({h}) => h.on.entering(),
  snapshotTaken: page => {
    if (page.host) {
      page.h.on.snapshot(hostPlaying)
      page.last = 'Your turn. You are X.'
    } else {
      page.h.on.snapshot(participantNext)
      page.last = 'Your turn. You are O.'
    }
  },
  hostAwayTold: ({h}) => h.on.hostAway(),
  hostBackTold: ({h}) => h.on.hostBack(),
  serverLostTold: ({h}) => h.on.serverLost(),
  serverBackTold: ({h}) => {
    h.on.serverLost()
    h.on.serverBack()
  },
  rulesErrorTold: ({h}) => h.on.rulesError(),
  canActTold: ({h}) => h.on.canAct(true),
  moveRefused: ({h}) => h.on.refused?.(1),
  joinRequestTold: ({h}) => h.on.joinRequest(request),
  requestEndedTold: ({h}) => h.on.requestEnded(request.number),
  cannotStartTold: ({h}) => h.on.cannotStart?.(),
  failsOrEnds: page => {
    if (page.last === '') {
      page.h.on.failed({cause: 'offline'})
    } else {
      page.h.on.ended({cause: 'room closed'})
    }
  }
}

const endText = (page: Page): string =>
  page.last === '' ? 'Cannot reach the game server. Check your internet connection.' : 'The room is closed, so the game is over.'

const rowText = (page: Page, outcome: RowOutcome, before: Page): string => {
  switch (outcome.row) {
    case 'the row of the last snapshot that the page took':
      return page.last
    case 'the text of 4-1':
      return endText(before)
    default:
      return outcome.row.replace('CODE', page.h.view.code ?? code)
  }
}

for (const [state, cells] of Object.entries(rows)) {
  for (const [event, cell] of Object.entries(cells)) {
    if (!('ids' in cell)) {
      continue
    }
    test(`${cell.ids.join(' ')} status row ${state}, ${event}`, async () => {
      const page = rowSetups[state as RowState](event as Event)
      const before = {...page}
      await fire[event as Event](page)
      const {status} = page.h.view
      assert.ok(status.endsWith(rowText(page, cell.outcome, before)), `${status} ends with ${rowText(page, cell.outcome, before)}`)
    })
  }
}

const noteSetups = (note: 'serverLost' | 'rulesError') => {
  const cause = (page: Page): Page => {
    if (note === 'serverLost') {
      page.h.on.serverLost()
    } else {
      page.h.on.rulesError()
    }
    return page
  }
  const noCause = (event: Event): Page => {
    switch (event) {
      case 'startPressed':
      case 'formCode':
        return lobby()
      case 'opensWithCode':
        return unopened()
      case 'codeTold':
        return creating()
      case 'waitingDecidesTold':
      case 'waitingOfflineTold':
      case 'enteringTold':
        return entering()
      case 'hostAwayTold':
        return participantPlays()
      case 'hostBackTold':
        return hostAway()
      default:
        return hostPlays()
    }
  }
  return {noCause, causeHolds: () => cause(hostPlays())}
}

const noteTests = (name: string, table: NoteTable, note: 'serverLost' | 'rulesError', text: string): void => {
  const setups = noteSetups(note)
  for (const [state, cells] of Object.entries(table)) {
    for (const [event, cell] of Object.entries(cells)) {
      if (!('ids' in cell)) {
        continue
      }
      test(`${cell.ids.join(' ')} ${name} ${state}, ${event}`, async () => {
        const page = state === 'noCause' ? setups.noCause(event as Event) : setups.causeHolds()
        await fire[event as Event](page)
        if (event === 'leavePressed' || event === 'addressNotCode') {
          page.h.page.startPressed()
          page.h.on.code(code)
          page.h.on.snapshot(hostAlone)
        }
        assert.equal(page.h.view.status.includes(text), (cell.outcome as NoteOutcome).next === 'causeHolds')
      })
    }
  }
}

noteTests('lost-server note', serverLostNote, 'serverLost', lostServer)
noteTests('rules-error note', rulesErrorNote, 'rulesError', gameError)

test('3-1 a page that entered shows that it looks for the room until its first snapshot, also when the host returns by record and a rules error comes first', () => {
  const h = pageHarness(code)
  h.page.open()
  assert.equal(h.view.status, `Looking for room ${code}…`)
  h.on.entering()
  h.on.rulesError()
  assert.equal(h.view.status, `${gameError} Looking for room ${code}…`)
  h.on.snapshot(hostAlone)
  assert.equal(h.view.status, `${gameError} ${waitingForPlayer}`)
})
