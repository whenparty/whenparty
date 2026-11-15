import type {ModuleMessage, Older, Path} from '@whenparty/transport'

export type Json = ModuleMessage

export type Visibility = 'visible' | 'hidden'

export type Role = 'owner' | 'participant'

export type Failure =
  | {readonly reason: 'bad app' | 'bad wait' | 'busy' | 'offline' | 'no room' | 'full' | 'unreachable' | 'open elsewhere'}
  | {readonly reason: 'refused'; readonly joinData: Json | undefined}
  | {readonly reason: 'outdated'; readonly older: Older}

export type Ending =
  | {readonly reason: 'unreachable' | 'no relay' | 'owner away' | 'room closed' | 'removed' | 'idle'}
  | {readonly reason: 'outdated'; readonly older: Older | 'owner'}

export interface JoinRequest {
  readonly number: number
  readonly joinData: Json
  letIn(): boolean
  refuse(joinData?: unknown): boolean
}

export interface RoomHandlers {
  returning?(role: Role, number: number, recordData: Json | undefined): unknown
  created?(code: string, term: number): unknown
  asked?(): unknown
  waitingForOwner?(): unknown
  letIn?(): unknown
  joined?(number: number): unknown
  failed?(failure: Failure): unknown
  ended?(ending: Ending): unknown
  ownerLost?(): unknown
  ownerBack?(): unknown
  ownerReturned?(term: number, roster: readonly number[]): unknown
  serverLost?(): unknown
  serverBack?(): unknown
  joinRequest?(request: JoinRequest): unknown
  requestEnded?(number: number): unknown
  participantJoined?(number: number, visibility: Visibility): unknown
  participantBack?(number: number, visibility: Visibility): unknown
  visibility?(number: number, visibility: Visibility): unknown
  participantLost?(number: number): unknown
  participantLeft?(number: number): unknown
  text?(text: string, from: number): unknown
  path?(number: number, path: Path, roundTripMs: number | null): unknown
}

export interface Room {
  send(text: unknown): boolean
  sendTo(number: number, text: unknown): boolean
  setRecordData(data: unknown): boolean
  leave(): void
}

export interface Rooms {
  parseCode(text: string): string | null
  create(appId: string, waitingSeconds: number | null, handlers: RoomHandlers): Room | null
  join(appId: string, codeText: string, joinData: unknown, handlers: RoomHandlers): Room | null
  return(appId: string, handlers: RoomHandlers): Room | null
}
