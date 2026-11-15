import './style.css'
import {createNetcode} from '@whenparty/netcode'
import {browserEnvironment} from '@whenparty/netcode/browser'
import {TicTacToePage, type View} from './page.ts'
import {title} from './tictactoe.ts'

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
const room = find<HTMLElement>('#game')
const codeLine = find<HTMLElement>('#code-line')
const roomCode = find<HTMLElement>('#room-code')
const copyLink = find<HTMLButtonElement>('#copy-link')
const statusText = find<HTMLElement>('#status')
const hostBadge = find<HTMLElement>('#host-badge')
const nextMatch = find<HTMLButtonElement>('#next-match')
const requests = find<HTMLElement>('#requests')
const board = find<HTMLElement>('#board')

const page: TicTacToePage = new TicTacToePage({
  createNetcode: handlers => createNetcode(title, handlers, browserEnvironment()),
  hash: () => location.hash.slice(1),
  replaceAddress: code => history.replaceState(null, '', code === null ? `${location.pathname}${location.search}` : `#${code}`),
  inviteLink: () => location.href,
  copy: async text => navigator.clipboard.writeText(text),
  after: (ms, then) => {
    const timer = setTimeout(then, ms)
    return () => clearTimeout(timer)
  },
  render: view => render(view)
})

const cells = Array.from({length: 9}, (_, index) => {
  const cell = document.createElement('button')
  cell.type = 'button'
  cell.ariaLabel = `Cell ${index + 1}`
  cell.addEventListener('click', () => page.cellClicked(index))
  board.append(cell)
  return cell
})

const requestRow = (number: number): HTMLElement => {
  const row = document.createElement('p')
  row.className = 'request'
  const text = document.createElement('span')
  text.textContent = 'A player wants to join.'
  const letIn = document.createElement('button')
  letIn.type = 'button'
  letIn.textContent = 'Let in'
  letIn.addEventListener('click', () => page.answered(number, true))
  const refuse = document.createElement('button')
  refuse.type = 'button'
  refuse.textContent = 'Refuse'
  refuse.addEventListener('click', () => page.answered(number, false))
  row.append(text, letIn, refuse)
  return row
}

const render = (view: View): void => {
  lobby.hidden = view.screen !== 'lobby'
  room.hidden = view.screen !== 'room'
  joinError.textContent = view.formError ?? ''
  codeLine.hidden = view.code === null
  roomCode.textContent = view.code ?? ''
  copyLink.textContent = view.copyLabel
  hostBadge.hidden = !view.hosting
  statusText.textContent = view.status
  nextMatch.hidden = !view.nextMatch
  cells.forEach((cell, index) => {
    cell.textContent = view.board[index] ?? ''
    cell.disabled = view.playable[index] !== true
    cell.classList.toggle('win', view.winning.includes(index))
  })
  requests.replaceChildren(...view.requests.map(requestRow))
}

find('#create').addEventListener('click', () => page.startPressed())
find('#join').addEventListener('submit', event => {
  event.preventDefault()
  page.submitted(codeInput.value)
})
copyLink.addEventListener('click', () => page.copyPressed())
nextMatch.addEventListener('click', () => page.startNextPressed())
find('#leave').addEventListener('click', () => page.leavePressed())
addEventListener('hashchange', () => page.addressChanged())

page.open()
