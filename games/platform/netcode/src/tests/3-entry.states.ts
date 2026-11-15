type State = 'joining' | 'waiting' | 'joined' | 'returning' | 'playing' | 'hostAway'

type Next = State | 'failed' | 'ended'

type Event =
  | 'asked'
  | 'waitingForOwner'
  | 'letIn'
  | 'joinCompleted'
  | 'refusedOtherVersion'
  | 'ownerLost'
  | 'ownerBack'
  | 'removedEntersAsNew'
  | 'snapshotTaken'
  | 'snapshotEqual'
  | 'snapshotDropped'
  | 'snapshotOtherVersion'

type Told = 'waiting: host decides' | 'waiting: host offline' | 'host away' | 'host back' | 'other version'

type Outcome = {
  readonly next: Next
  readonly told: readonly Told[]
  readonly leavesRoom?: true
}

type Cell<O> = {readonly ids: readonly string[]; readonly outcome: O} | {readonly impossible: string}

const joinOnly = {impossible: 'the rooms module tells this only on a first entry before the join completes'} as const
const askedFirst = {
  impossible: 'the owner answers only after the rooms module told the page that it is asked, which makes it wait (3-2)'
} as const
const noConnection = {
  impossible: 'no connection to the host is open before the join completes, so neither owner events nor snapshots arrive'
} as const
const nothingTaken = {impossible: 'the page has taken no snapshot that another could equal'} as const
const returnByRecordOnly = {impossible: 'the rooms module enters a page as new only on a return by record'} as const
const noJoinRequest = {impossible: 'a return by record makes no join request'} as const
const connectionOpen = {impossible: 'the rooms module tells owner back only after owner lost'} as const

export const table: {readonly [S in State]: {readonly [E in Event]: Cell<Outcome>}} = {
  joining: {
    asked: {ids: ['3-2', '3-1'], outcome: {next: 'waiting', told: ['waiting: host decides']}},
    waitingForOwner: {ids: ['3-2', '3-1'], outcome: {next: 'waiting', told: ['waiting: host offline']}},
    letIn: askedFirst,
    joinCompleted: {ids: ['3-3', '3-1'], outcome: {next: 'joined', told: []}},
    refusedOtherVersion: askedFirst,
    ownerLost: noConnection,
    ownerBack: noConnection,
    removedEntersAsNew: returnByRecordOnly,
    snapshotTaken: noConnection,
    snapshotEqual: noConnection,
    snapshotDropped: noConnection,
    snapshotOtherVersion: noConnection
  },
  waiting: {
    asked: {ids: ['3-2'], outcome: {next: 'waiting', told: ['waiting: host decides']}},
    waitingForOwner: {ids: ['3-2'], outcome: {next: 'waiting', told: ['waiting: host offline']}},
    letIn: {ids: ['3-2', '3-1'], outcome: {next: 'joining', told: []}},
    joinCompleted: {impossible: 'the join completes only after the owner let the page in, which ends waiting (3-2)'},
    refusedOtherVersion: {ids: ['3-5'], outcome: {next: 'failed', told: ['other version']}},
    ownerLost: noConnection,
    ownerBack: noConnection,
    removedEntersAsNew: returnByRecordOnly,
    snapshotTaken: noConnection,
    snapshotEqual: noConnection,
    snapshotDropped: noConnection,
    snapshotOtherVersion: noConnection
  },
  joined: {
    asked: joinOnly,
    waitingForOwner: joinOnly,
    letIn: joinOnly,
    joinCompleted: joinOnly,
    refusedOtherVersion: joinOnly,
    ownerLost: {ids: ['3-3'], outcome: {next: 'joined', told: []}},
    ownerBack: {ids: ['3-3'], outcome: {next: 'joined', told: []}},
    removedEntersAsNew: returnByRecordOnly,
    snapshotTaken: {ids: ['3-3', '3-1'], outcome: {next: 'playing', told: []}},
    snapshotEqual: nothingTaken,
    snapshotDropped: {ids: ['3-3'], outcome: {next: 'joined', told: []}},
    snapshotOtherVersion: {ids: ['3-5'], outcome: {next: 'failed', told: ['other version'], leavesRoom: true}}
  },
  returning: {
    asked: noJoinRequest,
    waitingForOwner: noJoinRequest,
    letIn: noJoinRequest,
    joinCompleted: noJoinRequest,
    refusedOtherVersion: noJoinRequest,
    ownerLost: {ids: ['3-7'], outcome: {next: 'returning', told: []}},
    ownerBack: {ids: ['3-7'], outcome: {next: 'returning', told: []}},
    removedEntersAsNew: {ids: ['3-7', '3-1'], outcome: {next: 'joining', told: []}},
    snapshotTaken: {ids: ['3-7', '3-1'], outcome: {next: 'playing', told: []}},
    snapshotEqual: nothingTaken,
    snapshotDropped: {ids: ['3-7'], outcome: {next: 'returning', told: []}},
    snapshotOtherVersion: {ids: ['3-5'], outcome: {next: 'ended', told: ['other version'], leavesRoom: true}}
  },
  playing: {
    asked: joinOnly,
    waitingForOwner: joinOnly,
    letIn: joinOnly,
    joinCompleted: joinOnly,
    refusedOtherVersion: joinOnly,
    ownerLost: {ids: ['3-6', '3-1'], outcome: {next: 'hostAway', told: ['host away']}},
    ownerBack: connectionOpen,
    removedEntersAsNew: returnByRecordOnly,
    snapshotTaken: {ids: ['3-1'], outcome: {next: 'playing', told: []}},
    snapshotEqual: {ids: ['3-1'], outcome: {next: 'playing', told: []}},
    snapshotDropped: {ids: ['3-1'], outcome: {next: 'playing', told: []}},
    snapshotOtherVersion: {ids: ['3-5'], outcome: {next: 'ended', told: ['other version'], leavesRoom: true}}
  },
  hostAway: {
    asked: joinOnly,
    waitingForOwner: joinOnly,
    letIn: joinOnly,
    joinCompleted: joinOnly,
    refusedOtherVersion: joinOnly,
    ownerLost: {ids: ['3-6'], outcome: {next: 'hostAway', told: []}},
    ownerBack: {ids: ['3-6'], outcome: {next: 'hostAway', told: []}},
    removedEntersAsNew: returnByRecordOnly,
    snapshotTaken: {ids: ['3-6', '3-1'], outcome: {next: 'playing', told: ['host back']}},
    snapshotEqual: {ids: ['3-6', '3-1'], outcome: {next: 'playing', told: ['host back']}},
    snapshotDropped: {ids: ['3-6'], outcome: {next: 'hostAway', told: []}},
    snapshotOtherVersion: {ids: ['3-5'], outcome: {next: 'ended', told: ['other version'], leavesRoom: true}}
  }
}
