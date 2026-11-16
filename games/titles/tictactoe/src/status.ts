import type {End, Failure, Snapshot, Waiting} from '@whenparty/netcode'
import {isPaused, marks, type Game, type Mark} from './tictactoe.ts'

export interface Played {
  readonly snapshot: Snapshot
  readonly seat: string | null
}

export type Finish = {readonly kind: 'failed'; readonly failure: Failure} | {readonly kind: 'ended'; readonly end: End}

export interface Shown {
  readonly code: string | null
  readonly isHost: boolean
  readonly starting: boolean
  readonly entering: boolean
  readonly waiting: Waiting | null
  readonly hostAway: boolean
  readonly serverLost: boolean
  readonly rulesError: boolean
  readonly played: Played | null
  readonly finish: Finish | null
  readonly waitedForHost: boolean
}

export const gameOf = (played: Played | null): Game | null => (played?.snapshot.state ?? null) as Game | null

const other = (mark: Mark): Mark => (mark === 'X' ? 'O' : 'X')

const seatTaken = (snapshot: Snapshot, mark: Mark): boolean => snapshot.seats[marks.indexOf(mark)] != null

const playText = ({snapshot, seat}: Played): string => {
  const game = gameOf({snapshot, seat})
  const result = game?.result ?? null
  if (!snapshot.running) {
    if (result?.kind === 'left' && !seatTaken(snapshot, result.seat)) {
      return `${result.seat} left, so the match is over. Send the code to a new player.`
    }
    if (!marks.every(mark => seatTaken(snapshot, mark))) {
      return 'Waiting for a second player. Send them the code.'
    }
    if (result?.kind === 'hidden') {
      return `${result.seat} was away too long, so the match is over.`
    }
    if (result?.kind === 'win') {
      return `${result.mark} wins.`
    }
    return result?.kind === 'draw' ? 'Draw.' : 'Ready for the next match.'
  }
  if (game === null) {
    return ''
  }
  if (isPaused(game)) {
    const away = marks.filter(mark => game.away[mark].lost || game.away[mark].hiddenSince !== null)
    return away.length === 2 ? 'Paused: both players are away.' : `Paused: ${away[0]} is away. The match goes on when they are back.`
  }
  if (seat === null) {
    return `You are watching. ${game.turn} to move.`
  }
  return seat === game.turn ? `Your turn. You are ${seat}.` : `You are ${seat}. ${other(seat as Mark)} to move.`
}

const endingOf = (finish: Finish, code: string, waitedForHost: boolean): string => {
  if (finish.kind === 'ended') {
    const {end} = finish
    switch (end.cause) {
      case 'other version':
        return end.older === 'host'
          ? 'The host runs an older version of the game. Ask them to reload the page.'
          : 'This game was updated. Reload the page.'
      case 'outdated':
        return end.older === 'page'
          ? 'This game was updated. Reload the page.'
          : 'The game server is being updated. Try again in a few minutes.'
      case 'removed':
        return 'You were away too long, so you left this game.'
      case 'owner away':
        return 'The connection was lost for too long, so the game is over.'
      case 'idle':
        return 'Nobody played for a while, so the room is closed.'
      case 'unreachable':
      case 'no relay':
        return 'Lost the connection to the host and could not get it back.'
      case 'room closed':
        return 'The room is closed, so the game is over.'
    }
  }
  const {failure} = finish
  switch (failure.cause) {
    case 'other version':
      return failure.older === 'page'
        ? 'This game was updated. Reload the page.'
        : `The host of ${code} runs an older version of the game. Ask them to reload the page.`
    case 'outdated':
      return failure.older === 'page'
        ? 'This game was updated. Reload the page.'
        : 'The game server is being updated. Try again in a few minutes.'
    case 'bad rules':
      return 'This game has an error and cannot start.'
    case 'busy':
      return 'The game server is busy. Try again in a few minutes.'
    case 'bad app':
    case 'bad wait':
      return 'This game was updated. Reload the page.'
    case 'no room':
      return waitedForHost ? `Room ${code} is closed.` : `Nobody hosts ${code}. Check the code with the room creator.`
    case 'owner away':
      return `The host of ${code} is offline. Try again in a moment.`
    case 'full':
      return `Room ${code} is full.`
    case 'refused':
      return `The host of ${code} did not let you in.`
    case 'unreachable':
      return `Found room ${code}, but could not connect to its host. A network on the way may block the connection. Try again in a moment, or switch between Wi-Fi and mobile data.`
    case 'offline':
      return 'Cannot reach the game server. Check your internet connection.'
    case 'open elsewhere':
      return 'This game is open in another tab. Close it and reload this page.'
  }
}

export const statusOf = (shown: Shown): string => {
  const code = shown.code ?? ''
  if (shown.finish !== null) {
    return endingOf(shown.finish, code, shown.waitedForHost)
  }
  if (shown.starting) {
    return 'Creating a room…'
  }
  if (shown.waiting === 'decides') {
    return `Waiting for the host of ${code} to let you in…`
  }
  if (shown.waiting === 'offline') {
    return `Waiting for the host of ${code} to come back…`
  }
  if (shown.hostAway) {
    return 'The connection to the host is lost. The game goes on when it is back.'
  }
  const prefixes = [
    ...(shown.serverLost ? ['New players cannot join right now: the game server is out of reach.'] : []),
    ...(shown.rulesError ? ['This game has an error.'] : [])
  ]
  const rest = shown.entering ? `Looking for room ${code}…` : shown.played === null ? '' : playText(shown.played)
  return [...prefixes, rest].filter(text => text !== '').join(' ')
}
