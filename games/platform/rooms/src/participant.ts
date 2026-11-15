import type {Ending} from './api.ts'
import type {LinkEnd, SignalingLink} from './link.ts'
import {PeerLink, type EndMessage} from './peer.ts'
import type {ServerMessage} from './protocol.ts'
import {deleteRecord, type ParticipantRecord} from './record.ts'
import {isRoomText, Session, type SessionContext} from './session.ts'
import type {Cancel} from './timers.ts'

const retryMs = 5_000
const spacingMs = 5_000
const lastAttemptMs = 30_000
const joinMs = 45_000

type ParticipantState =
  | 'asking'
  | 'askingAgain'
  | 'waiting'
  | 'asked'
  | 'attempting'
  | 'returning'
  | 'pausing'
  | 'spacing'
  | 'lateAttempting'
  | 'in'
  | 'lostReturning'
  | 'lostPausing'
  | 'lostAttempting'

const beforeLetIn = new Set<ParticipantState>(['asking', 'askingAgain', 'waiting', 'asked'])
const entering = new Set<ParticipantState>(['attempting', 'returning', 'pausing', 'spacing', 'lateAttempting'])
const lost = new Set<ParticipantState>(['lostReturning', 'lostPausing', 'lostAttempting'])

export class ParticipantSession extends Session {
  state: ParticipantState
  #link: SignalingLink | null = null
  #peer: PeerLink | null = null
  #code: string
  #joinData: unknown = null
  #token = ''
  #number = 0
  #wait = 600
  #owner = ''
  #letInAt = 0
  #lastAttemptAt = 0
  #ownerLostSince: number | null = null
  #gavePeer = false
  #noRelay = false
  #returnLinkFailed = false
  #fromRecordCode = false
  readonly #cancels = new Set<Cancel>()

  private constructor(ctx: SessionContext, state: ParticipantState, code: string) {
    super(ctx)
    this.state = state
    this.#code = code
  }

  static join(ctx: SessionContext, code: string, joinData: unknown, link: SignalingLink | null): ParticipantSession {
    const session = new ParticipantSession(ctx, 'asking', code)
    session.#joinData = joinData
    session.#use(link)
    return session
  }

  static returnFrom(ctx: SessionContext, record: ParticipantRecord, joinData: unknown, fromRecordCode: boolean): ParticipantSession {
    const session = new ParticipantSession(ctx, 'lostReturning', record.code)
    session.#joinData = joinData
    session.#token = record.token
    session.#number = record.number
    session.#wait = record.wait
    session.#fromRecordCode = fromRecordCode
    session.written = true
    session.#ownerLostSince = record.ownerLostSince ?? session.now()
    session.persist()
    session.#startWaitingTime()
    session.#use(null)
    return session
  }

  #after(milliseconds: number, callback: () => void): void {
    const cancel = this.timers.at(this.now() + milliseconds, () => {
      this.#cancels.delete(cancel)
      callback()
    })
    this.#cancels.add(cancel)
  }

  #at(at: number, callback: () => void): Cancel {
    const cancel = this.timers.at(at, () => {
      this.#cancels.delete(cancel)
      callback()
    })
    this.#cancels.add(cancel)
    return cancel
  }

  #use(link: SignalingLink | null): void {
    const events = {
      opened: () => {
        if (this.#link === link) {
          this.#opened()
        }
      },
      notice: () => {},
      ended: (end: LinkEnd) => {
        if (this.#link === link) {
          this.#link = null
          this.#linkEnded(end)
        }
      }
    }
    if (link === null) {
      link = this.page.openLink(events)
      this.#link = link
    } else {
      this.#link = link
      link.adopt(events)
      if (link.state === 'open') {
        this.#opened()
      }
    }
  }

  #opened(): void {
    if (this.done || this.#link === null) {
      return
    }
    this.#returnLinkFailed = false
    if (this.state === 'asking' || this.state === 'askingAgain') {
      this.#askJoin(this.#link)
    } else if (this.state === 'returning' || this.state === 'lostReturning') {
      this.#requestReturn(this.#link)
    }
  }

  #linkEnded(end: LinkEnd): void {
    if (this.done) {
      return
    }
    if (end.kind === 'outdated') {
      if (beforeLetIn.has(this.state) || entering.has(this.state)) {
        this.fail({reason: 'outdated', older: end.older})
      } else {
        this.end({reason: 'outdated', older: end.older})
      }
      return
    }
    if (beforeLetIn.has(this.state)) {
      this.fail({reason: 'offline'})
    } else if (this.state === 'returning' || this.state === 'lostReturning') {
      this.#returnLinkFailed = end.kind === 'cannot open'
      this.#pause()
    }
  }

  #askJoin(link: SignalingLink): void {
    link.request(
      {t: 'join', app: this.ctx.appId, code: this.#code, data: this.#joinData},
      {
        asked: () => {
          this.state = 'asked'
          this.tell('asked')
        },
        answer: answer => this.#joinAnswer(answer),
        noAnswer: () => this.fail({reason: 'offline'})
      }
    )
  }

  #joinAnswer(answer: ServerMessage): void {
    if (answer.t === 'let in') {
      this.#token = answer.token
      this.#number = answer.n
      this.#wait = answer.wait
      this.#owner = answer.owner
      this.#letInAt = this.now()
      this.tell('letIn')
      this.#at(this.#letInAt + lastAttemptMs, () => this.#passed30())
      this.#at(this.#letInAt + joinMs, () => this.#passed45())
      this.#attempt('attempting')
    } else if (answer.t === 'refused') {
      this.fail({reason: 'refused', joinData: answer.data as never})
    } else if (answer.t === 'answer' && answer.a === 'owner away') {
      if (this.state !== 'askingAgain') {
        this.tell('waitingForOwner')
      }
      this.state = 'waiting'
      this.#after(retryMs, () => {
        this.state = 'askingAgain'
        if (this.#link?.state === 'open') {
          this.#askJoin(this.#link)
        } else {
          this.fail({reason: 'offline'})
        }
      })
    } else if (answer.t === 'answer' && (answer.a === 'no room' || answer.a === 'full' || answer.a === 'busy' || answer.a === 'bad app')) {
      this.fail({reason: answer.a})
    } else {
      this.fail({reason: 'offline'})
    }
  }

  #attempt(state: 'attempting' | 'lateAttempting' | 'lostAttempting'): void {
    this.state = state
    this.#lastAttemptAt = this.now()
    const link = this.#link
    if (link === null) {
      queueMicrotask(() => this.#attemptClosed(null, 'offline'))
      return
    }
    const peerLink: PeerLink = new PeerLink(
      link.connection.connect(this.#owner),
      'participant',
      this.timers,
      {
        opened: () => {
          if (this.#peer === peerLink) {
            this.#openedForRooms()
          }
        },
        text: text => {
          if (this.#peer === peerLink && this.state === 'in') {
            this.tell('text', text, 1)
          }
        },
        end: end => {
          if (this.#peer === peerLink && this.state === 'in') {
            this.#ownerEnded(end)
          }
        },
        path: (path, roundTripMs) => {
          if (this.#peer === peerLink && this.state === 'in') {
            this.tell('path', 1, path, roundTripMs)
          }
        },
        closed: closing => this.#attemptClosed(peerLink, closing.reason, closing.lastArrivalAt)
      },
      () => this.page.env.visibility()
    )
    this.#peer = peerLink
  }

  #openedForRooms(): void {
    const wasLost = this.state === 'lostAttempting'
    this.state = 'in'
    for (const cancel of this.#cancels) {
      cancel()
    }
    this.#cancels.clear()
    if (wasLost) {
      this.#ownerLostSince = null
      this.persist()
      this.tell('ownerBack')
    } else {
      this.tell('joined', this.#number)
      this.firstWrite()
    }
    const latest = this.#peer?.latest
    if (latest) {
      this.tell('path', 1, latest.path, latest.roundTripMs)
    }
  }

  #ownerEnded(end: EndMessage): void {
    if (end.reason === 'outdated') {
      this.end({reason: 'outdated', older: end.older === 'page' ? 'owner' : 'server'})
    } else {
      this.end({reason: end.reason})
    }
  }

  #attemptClosed(peerLink: PeerLink | null, reason: string, lastArrivalAt = this.now()): void {
    if (this.done || this.#peer !== peerLink) {
      return
    }
    this.#peer = null
    this.#noRelay = reason === 'no relay'
    switch (this.state) {
      case 'attempting':
        this.state = 'returning'
        return this.#askReturn()
      case 'lateAttempting':
        return this.#failLeaving('unreachable')
      case 'in':
        this.state = 'lostReturning'
        this.#ownerLostSince = lastArrivalAt
        this.persist()
        this.tell('ownerLost')
        this.#startWaitingTime()
        return this.#askReturn()
      case 'lostAttempting':
        return this.#pause()
    }
  }

  #askReturn(): void {
    if (this.#link?.state === 'open') {
      this.#requestReturn(this.#link)
    } else if (this.#link?.state !== 'opening') {
      this.#use(null)
    }
  }

  #requestReturn(link: SignalingLink): void {
    link.request(
      {t: 'return', app: this.ctx.appId, code: this.#code, token: this.#token},
      {answer: answer => this.#returnAnswer(answer), noAnswer: () => this.#pause()}
    )
  }

  #waited(): boolean {
    return this.#ownerLostSince !== null && this.now() >= this.#ownerLostSince + this.#wait * 1000
  }

  #returnAnswer(answer: ServerMessage): void {
    const joining = this.state === 'returning'
    if (answer.t === 'owner') {
      this.#gavePeer = true
      this.#owner = answer.peer
      if (!joining) {
        this.#attempt('lostAttempting')
      } else if (this.now() >= this.#lastAttemptAt + spacingMs) {
        this.#attempt('attempting')
      } else {
        this.state = 'spacing'
        this.#at(this.#lastAttemptAt + spacingMs, () => {
          if (this.state === 'spacing') {
            this.#attempt('attempting')
          }
        })
      }
      return
    }
    const simple = answer.t === 'answer' ? answer.a : null
    if (simple === 'owner away') {
      this.#gavePeer = false
      this.#pause()
    } else if (simple === 'no room') {
      if (joining) {
        this.fail({reason: 'no room'})
      } else {
        this.end({reason: this.#waited() ? 'owner away' : 'room closed'})
      }
    } else if (simple === 'removed') {
      if (joining) {
        this.fail({reason: 'unreachable'})
      } else if (this.#fromRecordCode) {
        this.#joinAsNew()
      } else {
        this.end({reason: 'removed'})
      }
    } else {
      this.#pause()
    }
  }

  #joinAsNew(): void {
    deleteRecord(this.page.env.storage, this.ctx.appId)
    this.written = false
    for (const cancel of this.#cancels) {
      cancel()
    }
    this.#cancels.clear()
    this.#token = ''
    this.#number = 0
    this.#ownerLostSince = null
    this.state = 'asking'
    if (this.#link?.state === 'open') {
      this.#askJoin(this.#link)
    } else if (this.#link?.state !== 'opening') {
      this.#use(null)
    }
  }

  #pause(): void {
    if (this.done) {
      return
    }
    const joining = entering.has(this.state)
    this.state = joining ? 'pausing' : 'lostPausing'
    this.#after(retryMs, () => {
      this.state = joining ? 'returning' : 'lostReturning'
      this.#askReturn()
    })
  }

  #passed30(): void {
    switch (this.state) {
      case 'attempting':
        this.state = 'lateAttempting'
        return
      case 'returning':
        return this.#link?.state === 'opening' ? this.fail({reason: 'offline'}) : this.#failLeaving('unreachable')
      case 'pausing':
        return this.#returnLinkFailed ? this.fail({reason: 'offline'}) : this.#failLeaving('unreachable')
      case 'spacing':
        return this.#lastAttemptAt + spacingMs <= this.#letInAt + lastAttemptMs
          ? this.#attempt('lateAttempting')
          : this.#failLeaving('unreachable')
    }
  }

  #passed45(): void {
    if (this.state === 'lateAttempting') {
      this.#peer?.close()
      this.#peer = null
      this.#failLeaving('unreachable')
    }
  }

  #failLeaving(reason: 'unreachable'): void {
    this.#link?.send({t: 'leave', app: this.ctx.appId, code: this.#code, token: this.#token})
    this.fail({reason})
  }

  #startWaitingTime(): void {
    if (this.#ownerLostSince === null) {
      return
    }
    this.#at(this.#ownerLostSince + this.#wait * 1000, () => {
      if (!lost.has(this.state)) {
        return
      }
      const ending: Ending = {reason: this.#gavePeer ? (this.#noRelay ? 'no relay' : 'unreachable') : 'owner away'}
      this.#link?.send({t: 'leave', app: this.ctx.appId, code: this.#code, token: this.#token})
      this.end(ending)
    })
  }

  protected override visibilityChanged(): void {
    this.#peer?.sendVisibility(this.page.env.visibility())
  }

  record(): ParticipantRecord {
    return {
      role: 'participant',
      code: this.#code,
      token: this.#token,
      number: this.#number,
      wait: this.#wait,
      ...this.dataPart(),
      ownerLostSince: this.#ownerLostSince
    }
  }

  closeConnections(): void {
    for (const cancel of this.#cancels) {
      cancel()
    }
    this.#cancels.clear()
    this.#link?.close()
    this.#link = null
    this.#peer?.close()
    this.#peer = null
  }

  send(text: unknown): boolean {
    return !this.done && this.state === 'in' && isRoomText(text) && this.#peer !== null && this.#peer.sendText(text)
  }

  sendTo(number: number, text: unknown): boolean {
    return number === 1 && this.send(text)
  }

  leave(): void {
    if (this.done) {
      return
    }
    if (beforeLetIn.has(this.state)) {
      this.#link?.send({t: 'withdraw'})
      this.quit(false)
      return
    }
    this.#link?.send({t: 'leave', app: this.ctx.appId, code: this.#code, token: this.#token})
    this.#peer?.sendLeave()
    this.quit(true)
  }
}
