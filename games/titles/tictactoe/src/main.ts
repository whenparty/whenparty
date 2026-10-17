import './style.css'
import {ROOM_CODE_LENGTH, createRoomCode, isFull, normalizeRoomCode, seatOf, startSession} from '@whenparty/p2p'
import type {Session, SessionView} from '@whenparty/p2p'
import {ticTacToe, type TicTacToe} from './tictactoe.ts'

const appId = 'when.party/tictactoe'
// A guest that has not heard from a host by then gets a hint to check the code
const hostHintMs = 10_000

// The room this tab is in
interface Visit {
  code: string
  session: Session<number> | null
  view: SessionView<TicTacToe> | null
  hostIsLate: boolean
}

let visit: Visit | null = null

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
const restartButton = find<HTMLButtonElement>('#restart')

const cells = Array.from({length: 9}, (_, index) => {
  const cell = document.createElement('button')
  cell.type = 'button'
  cell.ariaLabel = `Cell ${index + 1}`
  cell.addEventListener('click', () => visit?.session?.send({type: 'move', move: index}))
  find('#board').append(cell)
  return cell
})

const describe = ({code, view, hostIsLate}: Visit): string => {
  if (view?.hostLeft) {
    return 'The host left, so the game is over.'
  }

  if (!view?.room) {
    return hostIsLate ? `Nobody is hosting ${code} yet. Check the code.` : `Looking for room ${code}…`
  }

  const {game} = view.room
  const seat = seatOf(view.room, view.selfId)

  if (!isFull(view.room)) {
    return seat ? 'Waiting for a second player. Send them the code.' : 'Waiting for players.'
  }

  if (game.winner === 'draw') {
    return 'Draw.'
  }

  if (game.winner) {
    return game.winner === seat ? 'You win!' : `${game.winner} wins.`
  }

  if (!seat) {
    return `You are watching. ${game.turn} to move.`
  }

  return game.turn === seat ? `Your turn. You are ${seat}.` : `You are ${seat}. ${game.turn} to move.`
}

const render = (current: Visit) => {
  const {view} = current
  const room = view?.room ?? null
  const seat = view && room ? seatOf(room, view.selfId) : null
  const game = room?.game
  // Moves and rematches need the host, a full room and a seat. Otherwise the board is read-only.
  const isLive = Boolean(room && seat && !view?.hostLeft && isFull(room))
  const canMove = isLive && game?.winner === null && game.turn === seat

  statusText.textContent = describe(current)
  cells.forEach((cell, index) => {
    const mark = game?.board[index] ?? null
    cell.textContent = mark ?? ''
    cell.disabled = !canMove || mark !== null
    cell.classList.toggle('win', game?.line.includes(index) ?? false)
  })
  restartButton.hidden = !(isLive && game && ticTacToe.isOver(game))
}

const enterRoom = (code: string, isHost: boolean) => {
  const entry: Visit = {code, session: null, view: null, hostIsLate: false}
  const refresh = () => {
    if (visit === entry) {
      render(entry)
    }
  }

  visit = entry
  entry.session = startSession({
    appId,
    code,
    isHost,
    rules: ticTacToe,
    onChange: view => {
      entry.view = view
      refresh()
    }
  })
  setTimeout(() => {
    entry.hostIsLate = true
    refresh()
  }, hostHintMs)

  roomCode.textContent = code
  lobby.hidden = true
  gameSection.hidden = false
  render(entry)
}

const leaveRoom = () => {
  visit?.session?.leave().catch(error => console.warn('p2p:', error))
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

find('#create').addEventListener('click', () => enterRoom(createRoomCode(), true))

find('#join').addEventListener('submit', event => {
  event.preventDefault()
  const code = normalizeRoomCode(codeInput.value)

  if (!code) {
    joinError.textContent = `That is not a room code. Codes have ${ROOM_CODE_LENGTH} characters, like K7MXQ.`
    return
  }

  joinError.textContent = ''
  // Guests keep the code in the URL, so a reload takes them back to their seat
  history.replaceState(null, '', `#${code}`)
  enterRoom(code, false)
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

// An invite link (https://tictactoe.when.party/#K7MXQ) joins straight away
const linkedCode = normalizeRoomCode(location.hash.slice(1))

if (linkedCode) {
  enterRoom(linkedCode, false)
}
