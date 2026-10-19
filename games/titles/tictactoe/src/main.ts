import './style.css'
import {ROOM_CODE_LENGTH, createRoomCode, isFull, normalizeRoomCode, playerIdFrom, roomCodeFromHash, seatOf, startSession} from '@whenparty/p2p'
import type {Session, SessionOptions, SessionView} from '@whenparty/p2p'
import {canStartRoom, lostRoom, searchOf, type SearchState} from './search.ts'
import {ticTacToe, type TicTacToe} from './tictactoe.ts'

const appId = 'when.party/tictactoe'
// The same in every tab of this browser, so a reload comes back to its seat and a second tab takes it over
const playerId = playerIdFrom(() => localStorage)
// A guest that has not heard from a host by then gets a hint: check the code or the connection
const hostHintMs = 10_000
// How often the hint checks the connection to the signaling server again
const hintRefreshMs = 2_000
// The room this tab hosts, so that it hosts it again after a reload if nobody else is there
const hostingKey = 'tictactoe:hosting'

// The room this tab is in
interface Visit {
  code: string
  session: Session<number> | null
  view: SessionView<TicTacToe> | null
  hostIsLate: boolean
  stopHint: () => void
}

let visit: Visit | null = null

// sessionStorage lives as long as the tab and survives a reload. It may be unavailable.
const hostedRoom = (): string | null => {
  try {
    return sessionStorage.getItem(hostingKey)
  } catch {
    return null
  }
}

const rememberHosting = (code: string | null) => {
  try {
    if (code) {
      sessionStorage.setItem(hostingKey, code)
    } else {
      sessionStorage.removeItem(hostingKey)
    }
  } catch {
    // Without storage, a reloaded host just comes back as a guest
  }
}

const isReload = () =>
  performance.getEntriesByType('navigation').some(entry => (entry as PerformanceNavigationTiming).type === 'reload')

const find = <T extends Element>(selector: string): T => {
  const found = document.querySelector<T>(selector)

  if (!found) {
    throw new Error(`missing ${selector}`)
  }

  return found
}

const lobby = find<HTMLElement>('#lobby')
const codeInput = find<HTMLInputElement>('#code')
const joinError = find<HTMLElement>('#join-error')
const gameSection = find<HTMLElement>('#game')
const roomCode = find<HTMLElement>('#room-code')
const copyLink = find<HTMLButtonElement>('#copy-link')
const statusText = find<HTMLElement>('#status')
const hostBadge = find<HTMLElement>('#host-badge')
const restartButton = find<HTMLButtonElement>('#restart')
const startRoomButton = find<HTMLButtonElement>('#start-room')

const cells = Array.from({length: 9}, (_, index) => {
  const cell = document.createElement('button')
  cell.type = 'button'
  cell.ariaLabel = `Cell ${index + 1}`
  cell.addEventListener('click', () => visit?.session?.send({type: 'move', move: index}))
  find('#board').append(cell)
  return cell
})

const searchStateOf = ({session, view, hostIsLate}: Visit): SearchState => ({
  view,
  hostIsLate,
  signalingOpen: session?.isSignalingOpen() ?? true
})

// Why a guest has not found its room yet
const describeSearch = (current: Visit): string => {
  const {code} = current

  switch (searchOf(searchStateOf(current))) {
    case 'unreachable':
      return `Found room ${code}, but could not connect to the players in it. A network on the way blocks the connection. Try again in a moment, or switch between Wi-Fi and mobile data.`
    case 'offline':
      return 'Cannot reach the game server. Check your internet connection.'
    case 'nobody':
      return `Nobody is hosting ${code} yet. Check the code, or start the room yourself.`
    default:
      return `Looking for room ${code}…`
  }
}

// Who among the players is not here right now, for the status line
const absentNote = (view: SessionView<TicTacToe>, room: SessionView<TicTacToe>['room'] & object): string =>
  Object.entries(room.seats)
    .flatMap(([mark, playerId]) => {
      const absence = playerId && playerId !== view.playerId ? room.absent[playerId] : undefined
      return absence === 'away' ? [` ${mark} stepped away.`] : absence === 'offline' ? [` ${mark} lost the connection. Their seat is held.`] : []
    })
    .join('')

const describe = (current: Visit): string => {
  const {view} = current

  if (view?.hostLeft) {
    return 'The host left, so the game is over.'
  }

  if (view?.switchingHost) {
    return 'The host left. The next player takes over in a moment…'
  }

  if (!view?.room) {
    return describeSearch(current)
  }

  if (!view.inControl) {
    return 'This game is open in another tab of yours, which plays now.'
  }

  const {game} = view.room
  const seat = seatOf(view.room, view.playerId)

  if (!isFull(view.room)) {
    return seat ? 'Waiting for a second player. Send them the code.' : 'Waiting for players.'
  }

  if (game.winner === 'draw') {
    return 'Draw.'
  }

  if (game.winner) {
    return game.winner === seat ? 'You win!' : `${game.winner} wins.`
  }

  const turn = !seat ? `You are watching. ${game.turn} to move.` : game.turn === seat ? `Your turn. You are ${seat}.` : `You are ${seat}. ${game.turn} to move.`

  return `${turn}${absentNote(view, view.room)}`
}

const render = (current: Visit) => {
  const {view} = current
  const room = view?.room ?? null
  const seat = view && room ? seatOf(room, view.playerId) : null
  const game = room?.game
  // Moves and rematches need the host, a full room, a seat and the tab that controls the player.
  // Otherwise the board is read-only.
  const isLive = Boolean(room && seat && view?.inControl && !view?.hostLeft && !view?.switchingHost && isFull(room))
  const canMove = isLive && game?.winner === null && game.turn === seat

  statusText.textContent = describe(current)
  hostBadge.hidden = !view?.isHost
  cells.forEach((cell, index) => {
    const mark = game?.board[index] ?? null
    cell.textContent = mark ?? ''
    cell.disabled = !canMove || mark !== null
    cell.classList.toggle('win', game?.line.includes(index) ?? false)
  })
  restartButton.hidden = !(isLive && game && ticTacToe.isOver(game))
  startRoomButton.hidden = !canStartRoom(searchStateOf(current))
  startRoomButton.textContent = `Start room ${current.code}`
}

// The hint waits hostHintMs, then checks the connection to the signaling server again every
// hintRefreshMs: that can drop and come back without an event. It starts over when the tab has no
// room again.
const startHint = (entry: Visit, refresh: () => void) => {
  entry.stopHint()
  entry.hostIsLate = false
  let interval: ReturnType<typeof setInterval> | undefined
  const timeout = setTimeout(() => {
    entry.hostIsLate = true
    refresh()
    interval = setInterval(refresh, hintRefreshMs)
  }, hostHintMs)
  entry.stopHint = () => {
    clearTimeout(timeout)
    clearInterval(interval)
  }
}

type Entry = Pick<SessionOptions<TicTacToe, number>, 'isHost' | 'rejoinAsHost' | 'provisional'>

// rejoinAsHost: this tab hosted the room before it reloaded. provisional: it starts a room under a
// code someone gave it. See SessionOptions.
const enterRoom = (code: string, {isHost, rejoinAsHost = false, provisional = false}: Entry) => {
  const entry: Visit = {code, session: null, view: null, hostIsLate: false, stopHint: () => {}}
  const refresh = () => {
    if (visit === entry) {
      render(entry)
    }
  }

  visit = entry
  // The code stays in the URL, so a reload rejoins the room. It goes on under another host meanwhile.
  history.replaceState(null, '', `#${code}`)
  entry.session = startSession({
    appId,
    code,
    playerId,
    isHost,
    rejoinAsHost,
    provisional,
    rules: ticTacToe,
    onChange: view => {
      if (lostRoom(entry.view, view)) {
        startHint(entry, refresh)
      }

      entry.view = view

      if (visit === entry && view.room) {
        rememberHosting(view.isHost ? code : null)
      }

      refresh()
    }
  })
  startHint(entry, refresh)

  roomCode.textContent = code
  lobby.hidden = true
  gameSection.hidden = false
  render(entry)
}

const leaveRoom = () => {
  visit?.session?.leave().catch(error => console.warn('p2p:', error))
  visit?.stopHint()
  rememberHosting(null)
  visit = null
  history.replaceState(null, '', location.pathname)
  gameSection.hidden = true
  lobby.hidden = false
}

const flash = (button: HTMLButtonElement, text: string) => {
  const original = button.textContent
  button.textContent = text
  setTimeout(() => (button.textContent = original), 2000)
}

find('#create').addEventListener('click', () => enterRoom(createRoomCode(), {isHost: true}))

find('#join').addEventListener('submit', event => {
  event.preventDefault()
  const code = normalizeRoomCode(codeInput.value)

  if (!code) {
    joinError.textContent = `That is not a room code. Codes have ${ROOM_CODE_LENGTH} characters, like K7MXQ.`
    return
  }

  joinError.textContent = ''
  enterRoom(code, {isHost: false})
})

copyLink.addEventListener('click', () => {
  const link = `${location.origin}${location.pathname}#${visit?.code ?? ''}`

  navigator.clipboard.writeText(link).then(
    () => flash(copyLink, 'Copied'),
    () => flash(copyLink, 'Copy failed')
  )
})

restartButton.addEventListener('click', () => visit?.session?.send({type: 'restart'}))
startRoomButton.addEventListener('click', () => {
  const code = visit?.code

  if (code) {
    leaveRoom()
    enterRoom(code, {isHost: true, provisional: true})
  }
})
find('#leave').addEventListener('click', leaveRoom)

// An invite link (https://tictactoe.when.party/#K7MXQ) joins straight away. Opened in a tab that
// already shows the game, only the hash changes and the page does not reload, so listen for that too.
// enterRoom and leaveRoom set the hash with replaceState, which fires no hashchange.
const joinLinkedRoom = (rejoinAsHost: boolean) => {
  const code = roomCodeFromHash(location.hash)

  if (!code || code === visit?.code) {
    return
  }

  if (visit) {
    leaveRoom()
  }

  enterRoom(code, {isHost: false, rejoinAsHost})
}

addEventListener('hashchange', () => joinLinkedRoom(false))
// A host that reloads comes back with the code in the URL
const linkedCode = roomCodeFromHash(location.hash)
joinLinkedRoom(linkedCode !== null && isReload() && hostedRoom() === linkedCode)
