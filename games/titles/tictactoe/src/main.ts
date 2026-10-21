import './style.css'
import {
  ROOM_CODE_LENGTH,
  createRoomCode,
  isFull,
  normalizeRoomCode,
  playerIdFrom,
  roomCodeFromHash,
  seatOf,
  startSession
} from '@whenparty/p2p'
import type {Session, SessionOptions, SessionView} from '@whenparty/p2p'
import {lostRoom, searchOf, type SearchState} from './search.ts'
import {ticTacToe, type TicTacToe} from './tictactoe.ts'

const appId = 'when.party/tictactoe'
const playerId = playerIdFrom(() => localStorage)
const hostHintMs = 10_000
const hintRefreshMs = 2_000
const hostingKey = 'tictactoe:hosting'

interface Visit {
  code: string
  session: Session<number> | null
  view: SessionView<TicTacToe> | null
  hostIsLate: boolean
  stopHint: () => void
}

let visit: Visit | null = null

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
  } catch {}
}

const isReload = () => performance.getEntriesByType('navigation').some(entry => (entry as PerformanceNavigationTiming).type === 'reload')

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

const describeSearch = (current: Visit): string => {
  const {code} = current

  switch (searchOf(searchStateOf(current))) {
    case 'unreachable':
      return `Found room ${code}, but could not connect to the players in it. A network on the way blocks the connection. Try again in a moment, or switch between Wi-Fi and mobile data.`
    case 'offline':
      return 'Cannot reach the game server. Check your internet connection.'
    case 'nobody':
      return `Nobody is hosting ${code}. Check the code with the room creator.`
    default:
      return `Looking for room ${code}…`
  }
}

const pauseNote = (view: SessionView<TicTacToe>, room: SessionView<TicTacToe>['room'] & object): string | null => {
  const others = room.game.waitingFor.filter(mark => room.seats[mark] !== view.playerId)
  const why = others.map(mark => {
    return `${mark} is away.`
  })

  return others.length > 0 ? `Paused. ${why.join(' ')} The game waits for them to come back.` : null
}

const describe = (current: Visit): string => {
  const {view} = current

  if (view?.hostLeft) {
    return 'The host left, so the game is over.'
  }

  if (view?.waitingForHost) {
    return view.room ? 'Waiting for the room creator. The room closes if they are away for two minutes.' : 'Restoring your room…'
  }

  if (!view?.room) {
    return describeSearch(current)
  }

  if (!view.inControl) {
    return 'This game is open in another tab of yours, which plays now.'
  }

  const {game} = view.room
  const seat = seatOf(view.room, view.playerId)

  if (game.abandonedBy) {
    const over =
      game.abandonedBy === seat ? 'You were gone too long, so the match is over.' : `${game.abandonedBy} left, so the match is over.`
    return isFull(view.room) ? over : `${over} Waiting for a new player to start another one.`
  }

  if (!isFull(view.room)) {
    return seat ? 'Waiting for a second player. Send them the code.' : 'Waiting for players.'
  }

  if (game.winner === 'draw') {
    return 'Draw.'
  }

  if (game.winner) {
    return game.winner === seat ? 'You win!' : `${game.winner} wins.`
  }

  const pause = pauseNote(view, view.room)

  if (pause) {
    return pause
  }

  return !seat
    ? `You are watching. ${game.turn} to move.`
    : game.turn === seat
      ? `Your turn. You are ${seat}.`
      : `You are ${seat}. ${game.turn} to move.`
}

const render = (current: Visit) => {
  const {view} = current
  const room = view?.room ?? null
  const seat = view && room ? seatOf(room, view.playerId) : null
  const game = room?.game
  const isLive = Boolean(room && seat && view?.inControl && !view?.hostLeft && !view?.waitingForHost && isFull(room))
  const canMove = isLive && game && !ticTacToe.isOver(game) && game.waitingFor.length === 0 && game.turn === seat

  statusText.textContent = describe(current)
  hostBadge.hidden = !view?.isHost
  cells.forEach((cell, index) => {
    const mark = game?.board[index] ?? null
    cell.textContent = mark ?? ''
    cell.disabled = !canMove || mark !== null
    cell.classList.toggle('win', game?.line.includes(index) ?? false)
  })
  restartButton.hidden = !(isLive && game && ticTacToe.isOver(game))
}

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

type Entry = Pick<SessionOptions<TicTacToe, number>, 'isHost' | 'rejoinAsHost'>

const enterRoom = (code: string, {isHost, rejoinAsHost = false}: Entry) => {
  const entry: Visit = {code, session: null, view: null, hostIsLate: false, stopHint: () => {}}
  const refresh = () => {
    if (visit === entry) {
      render(entry)
    }
  }

  visit = entry
  history.replaceState(null, '', `#${code}`)
  entry.session = startSession({
    appId,
    code,
    playerId,
    isHost,
    rejoinAsHost,
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
find('#leave').addEventListener('click', leaveRoom)

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
const linkedCode = roomCodeFromHash(location.hash)
joinLinkedRoom(linkedCode !== null && isReload() && hostedRoom() === linkedCode)
