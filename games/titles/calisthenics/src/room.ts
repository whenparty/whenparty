// Joining, keeping and leaving a championship room in the browser, for any interface
import {createRoomCode, playerIdFrom, roomCodeFromHash, startSession} from '@whenparty/p2p'
import type {Session, SessionView} from '@whenparty/p2p'
import {calisthenics, type Championship, type Move} from './engine/index.ts'

const appId = 'when.party/calisthenics'
const hostHintMs = 10_000
const hintRefreshMs = 2_000
const hostingKey = 'calisthenics:hosting'

// looking: not long enough to tell yet. unreachable: the room is there, but this network can't
// connect to it. offline: no signaling server. nobody: nobody hosts the code.
export type Search = 'looking' | 'unreachable' | 'offline' | 'nobody'

export interface Visit {
  code: string
  view: SessionView<Championship> | null
  search: Search
}

export interface Room {
  create: () => void
  join: (code: string) => void
  send: (move: Move) => void
}

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

interface Current {
  code: string
  session: Session<Move> | null
  view: SessionView<Championship> | null
  hostIsLate: boolean
  stopHint: () => void
}

const searchOf = ({session, view, hostIsLate}: Current): Search => {
  if (view?.unreachable) {
    return 'unreachable'
  }

  if (!hostIsLate) {
    return 'looking'
  }

  return session?.isSignalingOpen() === false ? 'offline' : 'nobody'
}

// Follows invite links in the page's hash, and reports every change of the visit
export const openRoom = (onChange: (visit: Visit | null) => void): Room => {
  const playerId = playerIdFrom(() => localStorage)
  let current: Current | null = null

  const publish = (entry: Current) => {
    if (current === entry) {
      onChange({code: entry.code, view: entry.view, search: searchOf(entry)})
    }
  }

  const startHint = (entry: Current) => {
    entry.stopHint()
    entry.hostIsLate = false
    let interval: ReturnType<typeof setInterval> | undefined
    const timeout = setTimeout(() => {
      entry.hostIsLate = true
      publish(entry)
      interval = setInterval(() => publish(entry), hintRefreshMs)
    }, hostHintMs)
    entry.stopHint = () => {
      clearTimeout(timeout)
      clearInterval(interval)
    }
  }

  const enter = (code: string, isHost: boolean, rejoinAsHost = false) => {
    const entry: Current = {code, session: null, view: null, hostIsLate: false, stopHint: () => {}}

    current = entry
    history.replaceState(null, '', `#${code}`)
    entry.session = startSession({
      appId,
      code,
      playerId,
      isHost,
      rejoinAsHost,
      rules: calisthenics,
      onChange: view => {
        if (entry.view?.room && !view.room) {
          startHint(entry)
        }

        entry.view = view

        if (current === entry && view.room) {
          rememberHosting(view.isHost ? code : null)
        }

        publish(entry)
      }
    })
    startHint(entry)
    publish(entry)
  }

  const leave = () => {
    current?.session?.leave().catch(error => console.warn('p2p:', error))
    current?.stopHint()
    current = null
    rememberHosting(null)
    history.replaceState(null, '', location.pathname)
    onChange(null)
  }

  const joinLinked = (rejoinAsHost: boolean) => {
    const code = roomCodeFromHash(location.hash)

    if (!code || code === current?.code) {
      return
    }

    if (current) {
      leave()
    }

    enter(code, false, rejoinAsHost)
  }

  addEventListener('hashchange', () => joinLinked(false))
  const linked = roomCodeFromHash(location.hash)
  joinLinked(linked !== null && isReload() && hostedRoom() === linked)

  return {
    create: () => enter(createRoomCode(), true),
    join: code => enter(code, false),
    send: move => current?.session?.send({type: 'move', move})
  }
}
