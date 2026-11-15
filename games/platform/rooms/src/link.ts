import type {Older, PeerConnection, SignalingClosing, SignalingConnection, Transport} from '@whenparty/transport'
import {roomsModule, roomsVersion, type ServerMessage} from './protocol.ts'
import type {Cancel, Timers} from './timers.ts'

const answerMs = 15_000
const finalAnswerMs = 65_000

export type LinkEnd =
  | {readonly kind: 'cannot open'}
  | {readonly kind: 'closed'; readonly lastArrivalAt: number}
  | {readonly kind: 'outdated'; readonly older: Older}

export interface LinkEvents {
  opened(): void
  notice(message: ServerMessage): void
  ended(end: LinkEnd): void
  incoming?(peer: PeerConnection, caller: string): void
}

export interface RequestHandlers {
  answer(message: ServerMessage): void
  asked?(): void
  noAnswer(): void
}

interface Pending {
  readonly handlers: RequestHandlers
  cancel: Cancel
}

export class SignalingLink {
  state: 'opening' | 'open' | 'closed' = 'opening'
  readonly connection: SignalingConnection
  readonly #timers: Timers
  #events: LinkEvents
  readonly #pending = new Map<number, Pending>()
  #next = 1

  constructor(transport: Transport, timers: Timers, events: LinkEvents) {
    this.#timers = timers
    this.#events = events
    this.connection = transport.openSignaling({
      [roomsModule]: {
        version: roomsVersion,
        handlers: {
          open: timers.entered(() => {
            if (this.state === 'opening') {
              this.state = 'open'
              this.#events.opened()
            }
          }),
          message: timers.entered(message => this.#message(message)),
          closed: timers.entered(closing => this.#closed(closing))
        }
      }
    })
    this.#listen()
  }

  adopt(events: LinkEvents): void {
    this.#events = events
    this.#listen()
  }

  #listen(): void {
    const incoming = this.#events.incoming
    if (incoming) {
      this.connection.setIncoming(
        this.#timers.entered((peer: PeerConnection, caller: string) => {
          if (this.state !== 'closed') {
            incoming(peer, caller)
          } else {
            peer.close()
          }
        })
      )
    }
  }

  #message(message: unknown): void {
    if (this.state === 'closed' || typeof message !== 'object' || message === null) {
      return
    }
    const answer = message as ServerMessage
    const r = 'r' in answer ? answer.r : undefined
    const pending = r === undefined ? undefined : this.#pending.get(r)
    if (r === undefined || pending === undefined) {
      this.#events.notice(answer)
      return
    }
    if (answer.t === 'asked') {
      pending.cancel()
      pending.cancel = this.#timers.at(this.#timers.now() + finalAnswerMs, () => this.#noAnswer(r))
      pending.handlers.asked?.()
      return
    }
    pending.cancel()
    this.#pending.delete(r)
    pending.handlers.answer(answer)
  }

  #noAnswer(r: number): void {
    const pending = this.#pending.get(r)
    if (pending) {
      this.#pending.delete(r)
      this.close()
      pending.handlers.noAnswer()
    }
  }

  #closed(closing: SignalingClosing): void {
    if (this.state === 'closed') {
      return
    }
    const wasOpen = this.state === 'open'
    this.#stop()
    if (closing.reason === 'outdated') {
      this.#events.ended({kind: 'outdated', older: closing.older})
    } else if (!wasOpen) {
      this.#events.ended({kind: 'cannot open'})
    } else {
      this.#events.ended({kind: 'closed', lastArrivalAt: closing.lastArrivalAt})
    }
  }

  #stop(): void {
    this.state = 'closed'
    for (const pending of this.#pending.values()) {
      pending.cancel()
    }
    this.#pending.clear()
  }

  get waiting(): boolean {
    return this.#pending.size > 0
  }

  request(message: {readonly t: string; readonly [key: string]: unknown}, handlers: RequestHandlers): void {
    const r = this.#next++
    this.connection.send(roomsModule, {...message, r})
    this.#pending.set(r, {handlers, cancel: this.#timers.at(this.#timers.now() + answerMs, () => this.#noAnswer(r))})
  }

  send(message: {readonly t: string; readonly [key: string]: unknown}): boolean {
    return this.state === 'open' && this.connection.send(roomsModule, message)
  }

  close(): void {
    if (this.state !== 'closed') {
      this.#stop()
      this.connection.close()
    }
  }
}
