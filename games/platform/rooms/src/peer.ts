import type {Older, Path, PeerClosing, PeerConnection} from '@whenparty/transport'
import type {Visibility} from './api.ts'
import type {Timers} from './timers.ts'

export type EndReason = 'room closed' | 'idle' | 'outdated'

export interface EndMessage {
  readonly reason: EndReason
  readonly older?: Older
}

export interface PeerLinkEvents {
  opened?(visibility: Visibility | null): void
  visibility?(visibility: Visibility): void
  text?(text: string): void
  leave?(): void
  end?(end: EndMessage): void
  path?(path: Path, roundTripMs: number | null): void
  closed?(closing: PeerClosing): void
}

const isVisibility = (value: string): value is Visibility => value === 'visible' || value === 'hidden'
const endReasons = new Set(['room closed', 'idle', 'outdated'])

const parseEnd = (text: string): EndMessage | null => {
  try {
    const value = JSON.parse(text) as Partial<EndMessage>
    if (!endReasons.has(String(value.reason))) {
      return null
    }
    if (value.reason === 'outdated') {
      return value.older === 'page' || value.older === 'server' ? {reason: 'outdated', older: value.older} : null
    }
    return {reason: value.reason as EndReason}
  } catch {
    return null
  }
}

export class PeerLink {
  state: 'connecting' | 'waiting' | 'open' | 'closed' = 'connecting'
  latest: {readonly path: Path; readonly roundTripMs: number | null} | null = null
  readonly peer: PeerConnection
  readonly #side: 'owner' | 'participant'
  readonly #events: PeerLinkEvents

  constructor(peer: PeerConnection, side: 'owner' | 'participant', timers: Timers, events: PeerLinkEvents, visibility: () => Visibility) {
    this.peer = peer
    this.#side = side
    this.#events = events
    peer.handlers = {
      open: timers.entered((path, roundTripMs) => {
        if (this.state !== 'connecting') {
          return
        }
        this.latest = {path, roundTripMs}
        this.state = 'waiting'
        if (side === 'participant') {
          this.sendVisibility(visibility())
        }
      }),
      text: timers.entered(text => this.#arrived(text)),
      path: timers.entered((path, roundTripMs) => {
        if (this.state === 'closed') {
          return
        }
        this.latest = {path, roundTripMs}
        if (this.state === 'open') {
          events.path?.(path, roundTripMs)
        }
      }),
      closed: timers.entered(closing => {
        if (this.state !== 'closed') {
          this.state = 'closed'
          events.closed?.(closing)
        }
      })
    }
  }

  #arrived(text: string): void {
    const kind = text.charAt(0)
    const rest = text.slice(1)
    const owner = this.#side === 'owner'
    if (kind === 'v' && owner && isVisibility(rest)) {
      if (this.state === 'waiting') {
        this.state = 'open'
        this.peer.send('c')
        this.#events.opened?.(rest)
      } else if (this.state === 'open') {
        this.#events.visibility?.(rest)
      }
    } else if (kind === 'c' && !owner && rest === '' && this.state === 'waiting') {
      this.state = 'open'
      this.#events.opened?.(null)
    } else if (kind === 't' && this.state === 'open') {
      this.#events.text?.(rest)
    } else if (kind === 'l' && owner && rest === '' && this.state === 'open') {
      this.#events.leave?.()
    } else if (kind === 'e' && !owner && this.state === 'open') {
      const end = parseEnd(rest)
      if (end) {
        this.#events.end?.(end)
      }
    }
  }

  sendVisibility(visibility: Visibility): void {
    if (this.state === 'waiting' || this.state === 'open') {
      this.peer.send(`v${visibility}`)
    }
  }

  sendText(text: string): boolean {
    return this.state === 'open' && this.peer.send(`t${text}`)
  }

  sendLeave(): void {
    if (this.peer.state === 'open') {
      this.peer.send('l')
    }
  }

  sendEnd(end: EndMessage): void {
    if (this.state === 'open') {
      this.peer.send(`e${JSON.stringify(end)}`)
    }
  }

  close(): void {
    if (this.state !== 'closed') {
      this.state = 'closed'
      this.peer.close()
    }
  }
}
