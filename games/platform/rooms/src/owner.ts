import type {PeerConnection} from '@whenparty/transport'
import type {Ending, JoinRequest, Json, Visibility} from './api.ts'
import type {LinkEnd, SignalingLink} from './link.ts'
import {PeerLink, type EndMessage} from './peer.ts'
import {isJoinData, type ServerMessage} from './protocol.ts'
import type {OwnerRecord} from './record.ts'
import {isRoomText, Session, type SessionContext} from './session.ts'
import type {Cancel} from './timers.ts'

const retryMs = 5_000

type OwnerState = 'creating' | 'owning' | 'offlineReconnecting' | 'offlinePausing' | 'returningAsking' | 'returningPausing'

type NumberState = 'pending' | 'letInSent' | 'lostNew' | 'open' | 'lostJoined' | 'removed'

interface Entry {
  readonly n: number
  state: NumberState
  peerId: string | null
  link: PeerLink | null
  lossSince: number | null
  joined: boolean
  visibility: Visibility
  cancelLoss: Cancel | null
}

const known = (entry: Entry): boolean => entry.state === 'lostNew' || entry.state === 'open' || entry.state === 'lostJoined'

export class OwnerSession extends Session {
  state: OwnerState
  #link: SignalingLink | null = null
  #code = ''
  #token = ''
  #term = 1
  #wait: number
  #serverLostSince: number | null = null
  #toldServerLost = false
  readonly #numbers = new Map<number, Entry>()
  readonly #leaves = new Set<number>()
  #inFlight: readonly number[] = []
  #createWait: number | null = null
  #counting = false
  #aloneSince: number | null = null
  #unseenSince: number | null = null
  #cancelIdle: Cancel | null = null
  #cancelPause: Cancel | null = null
  #cancelDeadline: Cancel | null = null

  private constructor(ctx: SessionContext, state: OwnerState, wait: number) {
    super(ctx)
    this.state = state
    this.#wait = wait
  }

  static create(ctx: SessionContext, waitingSeconds: number | null, link: SignalingLink | null): OwnerSession {
    const session = new OwnerSession(ctx, 'creating', waitingSeconds ?? 600)
    session.#createWait = waitingSeconds
    session.#use(link)
    return session
  }

  static returnFrom(ctx: SessionContext, record: OwnerRecord): OwnerSession {
    const session = new OwnerSession(ctx, 'returningAsking', record.wait)
    session.#code = record.code
    session.#token = record.token
    session.#term = record.term
    session.written = true
    for (const leave of record.leaves) {
      session.#leaves.add(leave)
    }
    for (const number of record.numbers) {
      session.#addEntry(number.n, number.joined ? 'lostJoined' : 'lostNew', number.joined, number.lostSince ?? ctx.page.startedAt)
    }
    session.#serverLostSince = record.serverLostSince ?? session.now()
    session.persist()
    session.#cancelDeadline = session.timers.at(session.#serverLostSince + record.wait * 1000, () => session.end({reason: 'owner away'}))
    session.#use(null)
    return session
  }

  #use(link: SignalingLink | null): void {
    const events = {
      opened: () => {
        if (this.#link === link) {
          this.#opened()
        }
      },
      notice: (message: ServerMessage) => {
        if (this.#link === link && this.state === 'owning') {
          this.#notice(message)
        }
      },
      ended: (end: LinkEnd) => {
        if (this.#link === link) {
          this.#link = null
          this.#linkEnded(end)
        }
      },
      incoming: (peer: PeerConnection, caller: string) => this.#incoming(peer, caller)
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

  #waited(): boolean {
    return this.#serverLostSince !== null && this.now() >= this.#serverLostSince + this.#wait * 1000
  }

  #opened(): void {
    const link = this.#link
    if (link === null || this.done) {
      return
    }
    const {appId} = this.ctx
    if (this.state === 'creating') {
      link.request(
        {t: 'create', app: appId, wait: this.#createWait, page: this.page.pageId},
        {answer: answer => this.#created(answer), noAnswer: () => this.fail({reason: 'offline'})}
      )
    } else if (this.state === 'offlineReconnecting') {
      this.#inFlight = [...this.#leaves]
      link.request(
        {t: 'reconnect', app: appId, code: this.#code, token: this.#token, page: this.page.pageId, leaves: this.#inFlight},
        {answer: answer => this.#reconnected(answer), noAnswer: () => this.#pause()}
      )
    } else if (this.state === 'returningAsking') {
      this.#askReturn(link)
    }
  }

  #askReturn(link: SignalingLink): void {
    this.#inFlight = [...this.#leaves]
    link.request(
      {
        t: 'return',
        app: this.ctx.appId,
        code: this.#code,
        token: this.#token,
        term: this.#term,
        page: this.page.pageId,
        leaves: this.#inFlight
      },
      {answer: answer => this.#returned(link, answer), noAnswer: () => this.#pause()}
    )
  }

  #created(answer: ServerMessage): void {
    if (answer.t === 'created') {
      this.#code = answer.code
      this.#term = answer.term
      this.#token = answer.token
      this.state = 'owning'
      this.tell('created', answer.code, answer.term)
      this.firstWrite()
      this.#startCounting()
    } else if (answer.t === 'answer' && (answer.a === 'bad app' || answer.a === 'bad wait' || answer.a === 'busy')) {
      this.fail({reason: answer.a})
    } else {
      this.fail({reason: 'offline'})
    }
  }

  #linkEnded(end: LinkEnd): void {
    if (this.done) {
      return
    }
    if (end.kind === 'outdated') {
      if (this.state === 'creating') {
        this.fail({reason: 'outdated', older: end.older})
      } else {
        this.#endRoom({reason: 'outdated', older: end.older}, {reason: 'outdated', older: end.older})
      }
      return
    }
    switch (this.state) {
      case 'creating':
        return this.fail({reason: 'offline'})
      case 'owning':
        return this.#serverLost(end.kind === 'closed' ? end.lastArrivalAt : this.now())
      case 'offlineReconnecting':
      case 'returningAsking':
        return this.#pause()
    }
  }

  #serverLost(lastArrivalAt: number): void {
    for (const entry of [...this.#numbers.values()]) {
      if (entry.state === 'pending' || entry.state === 'letInSent') {
        this.#numbers.delete(entry.n)
        this.tell('requestEnded', entry.n)
      }
    }
    this.state = 'offlineReconnecting'
    if (!this.#toldServerLost) {
      this.#toldServerLost = true
      this.tell('serverLost')
    }
    this.#serverLostSince = lastArrivalAt
    this.persist()
    this.#updateIdle()
    this.#use(null)
  }

  #pause(): void {
    if (this.done) {
      return
    }
    this.#link?.close()
    this.#link = null
    const returning = this.state === 'returningAsking'
    this.state = returning ? 'returningPausing' : 'offlinePausing'
    this.#cancelPause = this.timers.at(this.now() + retryMs, () => {
      this.state = returning ? 'returningAsking' : 'offlineReconnecting'
      this.#use(null)
    })
  }

  #settleLeaves(): void {
    for (const number of this.#inFlight) {
      this.#leaves.delete(number)
    }
    this.#inFlight = []
    for (const number of [...this.#leaves]) {
      this.#leaves.delete(number)
      this.#link?.send({t: 'left', app: this.ctx.appId, code: this.#code, n: number})
    }
  }

  #reconnected(answer: ServerMessage): void {
    if (answer.t === 'roster') {
      this.state = 'owning'
      this.#serverLostSince = null
      this.#toldServerLost = false
      this.tell('serverBack')
      this.#settleLeaves()
      this.#applyRoster(answer.roster)
      this.persist()
      this.#updateIdle()
    } else if (answer.t === 'answer' && (answer.a === 'no room' || answer.a === 'removed')) {
      const reason = this.#waited() ? 'owner away' : 'room closed'
      this.#endRoom({reason}, {reason: 'room closed'})
    } else {
      this.#pause()
    }
  }

  #returned(link: SignalingLink, answer: ServerMessage): void {
    if (answer.t === 'term') {
      this.#term = answer.term
      this.persist()
      this.#askReturn(link)
    } else if (answer.t === 'roster') {
      this.#term = answer.term ?? this.#term
      this.state = 'owning'
      this.#cancelDeadline?.()
      this.#serverLostSince = null
      const roster = new Set(answer.roster)
      for (const entry of [...this.#numbers.values()]) {
        if (!roster.has(entry.n) && entry.state !== 'removed') {
          entry.cancelLoss?.()
          entry.link?.close()
          this.#numbers.delete(entry.n)
        }
      }
      const joined = answer.roster.filter(number => this.#numbers.get(number)?.joined === true)
      for (const number of answer.roster) {
        this.#rosterIncludes(number)
      }
      this.#settleLeaves()
      this.persist()
      this.tell('ownerReturned', this.#term, joined)
      this.#startCounting()
    } else if (answer.t === 'answer' && (answer.a === 'no room' || answer.a === 'removed')) {
      this.end({reason: this.#waited() ? 'owner away' : 'room closed'})
    } else {
      this.#pause()
    }
  }

  #applyRoster(roster: readonly number[]): void {
    const listed = new Set(roster)
    for (const entry of [...this.#numbers.values()]) {
      if (known(entry) && !listed.has(entry.n)) {
        this.#remove(entry, false)
      }
    }
    for (const number of roster) {
      this.#rosterIncludes(number)
    }
  }

  #rosterIncludes(number: number): void {
    const entry = this.#numbers.get(number)
    if (entry === undefined) {
      this.#addEntry(number, 'lostNew', false, this.now())
    } else if (entry.state === 'removed') {
      entry.link?.close()
      entry.link = null
      this.#tellLeave(number)
    }
  }

  #addEntry(n: number, state: NumberState, joined: boolean, lossSince: number | null): Entry {
    const entry: Entry = {n, state, peerId: null, link: null, lossSince, joined, visibility: 'hidden', cancelLoss: null}
    this.#numbers.set(n, entry)
    if (lossSince !== null) {
      this.#startLoss(entry, lossSince)
    }
    return entry
  }

  #startLoss(entry: Entry, since: number): void {
    entry.cancelLoss?.()
    entry.lossSince = since
    entry.cancelLoss = this.timers.at(since + this.#wait * 1000, () => this.#remove(entry, true))
  }

  #notice(message: ServerMessage): void {
    if (!('app' in message) || message.app !== this.ctx.appId || message.code !== this.#code) {
      return
    }
    switch (message.t) {
      case 'ask':
        return this.#ask(message.n, message.data as Json)
      case 'ended': {
        const entry = this.#numbers.get(message.n)
        if (entry?.state === 'pending' || entry?.state === 'letInSent') {
          this.#numbers.delete(message.n)
          this.tell('requestEnded', message.n)
          this.#updateIdle()
        }
        return
      }
      case 'named':
        return this.#named(message.n, message.peer)
      case 'left': {
        const entry = this.#numbers.get(message.n)
        if (entry && entry.state !== 'removed') {
          this.#remove(entry, false)
        }
        return
      }
      case 'closed':
        return this.#endRoom({reason: 'room closed'}, {reason: 'room closed'})
    }
  }

  #ask(n: number, joinData: Json): void {
    if (this.#numbers.has(n)) {
      return
    }
    const entry = this.#addEntry(n, 'pending', false, null)
    this.#updateIdle()
    const request: JoinRequest = {
      number: n,
      joinData,
      letIn: () => this.#answerRequest(entry, true, undefined),
      refuse: data => this.#answerRequest(entry, false, data)
    }
    const handler = this.ctx.handlers.joinRequest
    if (!handler || this.done) {
      return
    }
    try {
      const result = handler(request)
      if (typeof (result as PromiseLike<unknown> | null)?.then === 'function') {
        Promise.resolve(result).catch(() => request.refuse())
      }
    } catch {
      request.refuse()
    }
  }

  #answerRequest(entry: Entry, letIn: boolean, data: unknown): boolean {
    if (this.done || entry.state !== 'pending' || this.#numbers.get(entry.n) !== entry || this.#link === null) {
      return false
    }
    const message = {app: this.ctx.appId, code: this.#code, n: entry.n}
    if (letIn) {
      entry.state = 'letInSent'
      this.#link.send({t: 'admit', ...message})
    } else {
      this.#numbers.delete(entry.n)
      this.#link.send(isJoinData(data) && data !== undefined ? {t: 'refuse', ...message, data} : {t: 'refuse', ...message})
      this.#updateIdle()
    }
    return true
  }

  #named(n: number, peerId: string): void {
    const entry = this.#numbers.get(n)
    if (entry === undefined || entry.state === 'pending') {
      return
    }
    if (entry.state === 'removed') {
      entry.link?.close()
      entry.link = null
      this.#tellLeave(n)
      return
    }
    if (entry.state === 'letInSent') {
      entry.state = 'lostNew'
      entry.peerId = peerId
      this.#startLoss(entry, this.now())
      this.persist()
      this.#updateIdle()
      return
    }
    if (entry.peerId === peerId) {
      return
    }
    entry.peerId = peerId
    const older = entry.link
    entry.link = null
    older?.close()
    if (entry.state === 'open') {
      this.#lost(entry, this.now())
    }
  }

  #incoming(peer: PeerConnection, caller: string): void {
    const entry = [...this.#numbers.values()].find(
      candidate => candidate.peerId === caller && (known(candidate) || candidate.state === 'removed')
    )
    if (this.done || entry === undefined || entry.state === 'removed') {
      peer.close()
      return
    }
    const older = entry.link
    const link: PeerLink = new PeerLink(
      peer,
      'owner',
      this.timers,
      {
        opened: visibility => {
          if (entry.link === link) {
            this.#participantOpened(entry, visibility ?? 'hidden')
          }
        },
        visibility: visibility => {
          if (entry.link === link) {
            entry.visibility = visibility
            this.tell('visibility', entry.n, visibility)
            this.#updateIdle()
          }
        },
        text: text => {
          if (entry.link === link) {
            this.tell('text', text, entry.n)
          }
        },
        leave: () => {
          if (entry.link === link) {
            this.#remove(entry, true)
          }
        },
        path: (path, roundTripMs) => {
          if (entry.link === link) {
            this.tell('path', entry.n, path, roundTripMs)
          }
        },
        closed: closing => {
          if (entry.link === link) {
            entry.link = null
            if (entry.state === 'open') {
              this.#lost(entry, closing.lastArrivalAt)
            }
          }
        }
      },
      () => 'visible'
    )
    entry.link = link
    older?.close()
    if (older && entry.state === 'open') {
      this.#lost(entry, this.now())
    }
  }

  #participantOpened(entry: Entry, visibility: Visibility): void {
    entry.state = 'open'
    entry.visibility = visibility
    entry.cancelLoss?.()
    entry.cancelLoss = null
    entry.lossSince = null
    const first = !entry.joined
    entry.joined = true
    this.persist()
    this.tell(first ? 'participantJoined' : 'participantBack', entry.n, visibility)
    const latest = entry.link?.latest
    if (latest) {
      this.tell('path', entry.n, latest.path, latest.roundTripMs)
    }
    this.#updateIdle()
  }

  #lost(entry: Entry, since: number): void {
    entry.state = 'lostJoined'
    this.#startLoss(entry, since)
    this.persist()
    this.tell('participantLost', entry.n)
    this.#updateIdle()
  }

  #remove(entry: Entry, tellServer: boolean): void {
    entry.state = 'removed'
    entry.cancelLoss?.()
    entry.cancelLoss = null
    entry.link?.close()
    entry.link = null
    if (entry.joined) {
      this.tell('participantLeft', entry.n)
    }
    if (tellServer) {
      this.#tellLeave(entry.n)
    }
    this.persist()
    this.#updateIdle()
  }

  #tellLeave(n: number): void {
    if (this.state === 'owning' && this.#link?.state === 'open') {
      this.#link.send({t: 'left', app: this.ctx.appId, code: this.#code, n})
    } else {
      this.#leaves.add(n)
      this.persist()
    }
  }

  #startCounting(): void {
    this.#counting = true
    this.#aloneSince = null
    this.#unseenSince = null
    this.#updateIdle()
  }

  protected override visibilityChanged(): void {
    this.#updateIdle()
  }

  #updateIdle(): void {
    if (!this.#counting || this.done) {
      return
    }
    const now = this.now()
    const entries = [...this.#numbers.values()]
    const alone = !entries.some(entry => entry.state !== 'removed')
    const seen = this.page.env.visibility() === 'visible' || entries.some(entry => entry.state === 'open' && entry.visibility === 'visible')
    this.#aloneSince = alone ? (this.#aloneSince ?? now) : null
    this.#unseenSince = seen ? null : (this.#unseenSince ?? now)
    this.#cancelIdle?.()
    this.#cancelIdle = null
    const since = Math.min(this.#aloneSince ?? Infinity, this.#unseenSince ?? Infinity)
    if (since !== Infinity) {
      this.#cancelIdle = this.timers.at(since + this.#wait * 1000, () => this.#idle())
    }
  }

  #idle(): void {
    this.#link?.send({t: 'leave', app: this.ctx.appId, code: this.#code, token: this.#token})
    this.#endRoom({reason: 'idle'}, {reason: 'idle'})
  }

  #endRoom(ending: Ending, message: EndMessage): void {
    for (const entry of this.#numbers.values()) {
      entry.link?.sendEnd(message)
    }
    this.end(ending)
  }

  record(): OwnerRecord {
    return {
      role: 'owner',
      code: this.#code,
      token: this.#token,
      number: 1,
      wait: this.#wait,
      ...this.dataPart(),
      term: this.#term,
      serverLostSince: this.#serverLostSince,
      numbers: [...this.#numbers.values()]
        .filter(known)
        .map(entry => ({n: entry.n, joined: entry.joined, lostSince: entry.state === 'open' ? null : entry.lossSince})),
      leaves: [...this.#leaves]
    }
  }

  closeConnections(): void {
    this.#link?.close()
    this.#link = null
    for (const cancel of [this.#cancelIdle, this.#cancelPause, this.#cancelDeadline]) {
      cancel?.()
    }
    for (const entry of this.#numbers.values()) {
      entry.cancelLoss?.()
      entry.link?.close()
    }
  }

  send(text: unknown): boolean {
    if (this.done || !isRoomText(text)) {
      return false
    }
    for (const entry of this.#numbers.values()) {
      if (entry.state === 'open') {
        entry.link?.sendText(text)
      }
    }
    return true
  }

  sendTo(number: number, text: unknown): boolean {
    const entry = this.#numbers.get(number)
    return !this.done && isRoomText(text) && entry?.state === 'open' && entry.link !== null && entry.link.sendText(text)
  }

  leave(): void {
    if (this.done) {
      return
    }
    if (this.state === 'creating') {
      this.quit(false)
      return
    }
    this.#link?.send({t: 'leave', app: this.ctx.appId, code: this.#code, token: this.#token})
    for (const entry of this.#numbers.values()) {
      entry.link?.sendEnd({reason: 'room closed'})
    }
    this.quit(true)
  }
}
