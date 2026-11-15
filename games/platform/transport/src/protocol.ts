export const transportVersion = 1

export const signalingPath = '/platform'

export type Older = 'page' | 'server'

export type Rejection = 'no peer' | 'busy' | 'failed'

export interface Description {
  readonly type: 'offer' | 'answer'
  readonly sdp: string
}

export interface Candidate {
  readonly candidate: string
  readonly sdpMid: string | null
  readonly sdpMLineIndex: number | null
}

export interface TurnServers {
  readonly urls: readonly string[]
  readonly username: string
  readonly credential: string
}

export type PageMessage =
  | {readonly t: 'hello'; readonly v: number; readonly m: {readonly [module: string]: number}}
  | {readonly t: 'answer'; readonly n: number}
  | {readonly t: 'module'; readonly c: string; readonly m: unknown}
  | {readonly t: 'list'; readonly r: number; readonly p: string; readonly add: boolean}
  | {readonly t: 'turn'; readonly r: number}
  | {readonly t: 'call'; readonly pc: string; readonly to: string; readonly ms: number; readonly d: Description}
  | {readonly t: 'signal'; readonly pc: string; readonly d: Description}
  | {readonly t: 'signal'; readonly pc: string; readonly c: readonly Candidate[]}
  | {readonly t: 'close'; readonly pc: string; readonly reason: string}

export type ServerMessage =
  | {readonly t: 'id'; readonly p: string}
  | {readonly t: 'outdated'; readonly older: Older}
  | {readonly t: 'check'; readonly n: number}
  | {readonly t: 'module'; readonly c: string; readonly m: unknown}
  | {readonly t: 'list'; readonly r: number; readonly ok: boolean}
  | {readonly t: 'turn'; readonly r: number; readonly s: TurnServers | null}
  | {readonly t: 'call'; readonly pc: string; readonly from: string; readonly ms: number; readonly d: Description}
  | {readonly t: 'reject'; readonly pc: string; readonly reason: Rejection}
  | {readonly t: 'signal'; readonly pc: string; readonly from: string; readonly d: Description}
  | {readonly t: 'signal'; readonly pc: string; readonly from: string; readonly c: readonly Candidate[]}
  | {readonly t: 'close'; readonly pc: string; readonly from: string; readonly reason: string}
  | {readonly t: 'failed'; readonly pc: string}
  | {readonly t: 'gone'; readonly pc: string}
