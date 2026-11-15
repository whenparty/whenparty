type Cell<O> = { readonly ids: readonly string[]; readonly outcome: O } | { readonly impossible: string }

type StartState =
  | 'lockHeldElsewhere'
  | 'lockNotGiven'
  | 'lockHeldHere'
  | 'noRecord'
  | 'participantRecord'
  | 'ownerRecord'
  | 'leavingRecordRoom'

type StartEvent = 'create' | 'joinWithRecordCode' | 'joinWithAnotherCode' | 'return' | 'signalingOpens' | 'signalingCannotOpen'

type StartNext = StartState | 'failed' | 'creating' | 'joiningAsNew' | 'returningAsParticipant' | 'returningAsOwner'

type StartEffect = 'callFails' | 'recordStays' | 'appToldReturnAtOnce' | 'opensSignaling' | 'sendsLeaveWithRecordToken' | 'deletesRecord'

type StartSimple = {
  readonly next: StartNext
  readonly reason?: 'open elsewhere' | 'no room' | 'offline'
  readonly effects: readonly StartEffect[]
}

type StartOutcome = StartSimple | { readonly branches: readonly { readonly when: string; readonly outcome: StartSimple }[] }

const noSignalingYet = { impossible: 'the page opens no signaling connection before it starts' } as const
const elsewhere: Cell<StartOutcome> = { ids: ['9-2'], outcome: { next: 'failed', reason: 'open elsewhere', effects: ['recordStays'] } }
const busyHere: Cell<StartOutcome> = { ids: ['9-2'], outcome: { next: 'lockHeldHere', effects: ['callFails'] } }
const leaveFirst: Cell<StartOutcome> = { ids: ['9-5', '9-6'], outcome: { next: 'leavingRecordRoom', effects: ['opensSignaling'] } }
const lockless = {
  create: elsewhere,
  joinWithRecordCode: elsewhere,
  joinWithAnotherCode: elsewhere,
  return: elsewhere,
  signalingOpens: noSignalingYet,
  signalingCannotOpen: noSignalingYet,
} as const

export const start: { readonly [S in StartState]: { readonly [E in StartEvent]: Cell<StartOutcome> } } = {
  lockHeldElsewhere: lockless,
  lockNotGiven: lockless,
  lockHeldHere: {
    create: busyHere,
    joinWithRecordCode: busyHere,
    joinWithAnotherCode: busyHere,
    return: busyHere,
    signalingOpens: noSignalingYet,
    signalingCannotOpen: noSignalingYet,
  },
  noRecord: {
    create: { ids: ['9-5'], outcome: { next: 'creating', effects: [] } },
    joinWithRecordCode: { impossible: 'without a record there is no record code' },
    joinWithAnotherCode: { ids: ['9-5'], outcome: { next: 'joiningAsNew', effects: [] } },
    return: { ids: ['9-5'], outcome: { next: 'failed', reason: 'no room', effects: [] } },
    signalingOpens: noSignalingYet,
    signalingCannotOpen: noSignalingYet,
  },
  participantRecord: {
    create: leaveFirst,
    joinWithRecordCode: { ids: ['9-5', '9-8'], outcome: { next: 'returningAsParticipant', effects: ['appToldReturnAtOnce'] } },
    joinWithAnotherCode: leaveFirst,
    return: { ids: ['9-5', '9-8'], outcome: { next: 'returningAsParticipant', effects: ['appToldReturnAtOnce'] } },
    signalingOpens: noSignalingYet,
    signalingCannotOpen: noSignalingYet,
  },
  ownerRecord: {
    create: leaveFirst,
    joinWithRecordCode: { ids: ['9-5', '9-8'], outcome: { next: 'returningAsOwner', effects: ['appToldReturnAtOnce'] } },
    joinWithAnotherCode: leaveFirst,
    return: { ids: ['9-5', '9-8'], outcome: { next: 'returningAsOwner', effects: ['appToldReturnAtOnce'] } },
    signalingOpens: noSignalingYet,
    signalingCannotOpen: noSignalingYet,
  },
  leavingRecordRoom: {
    create: busyHere,
    joinWithRecordCode: busyHere,
    joinWithAnotherCode: busyHere,
    return: busyHere,
    signalingOpens: {
      ids: ['9-6'],
      outcome: {
        branches: [
          { when: 'the app creates', outcome: { next: 'creating', effects: ['sendsLeaveWithRecordToken', 'deletesRecord'] } },
          { when: 'the app joins', outcome: { next: 'joiningAsNew', effects: ['sendsLeaveWithRecordToken', 'deletesRecord'] } },
        ],
      },
    },
    signalingCannotOpen: { ids: ['9-6'], outcome: { next: 'failed', reason: 'offline', effects: ['recordStays'] } },
  },
}

type RecordState = 'beforeFirstWrite' | 'written'

type RecordEvent = 'appGivesRecordData' | 'appGivesNonJson' | 'firstWrite' | 'keptValueChanges' | 'writeFails'

type RecordOutcome = {
  readonly next: RecordState
  readonly effects: readonly ('keepsDataInMemory' | 'writesWholeRecord' | 'writesBeforeCallReturns' | 'callFails' | 'goesOnFromMemory')[]
}

export const record: { readonly [S in RecordState]: { readonly [E in RecordEvent]: Cell<RecordOutcome> } } = {
  beforeFirstWrite: {
    appGivesRecordData: { ids: ['9-7'], outcome: { next: 'beforeFirstWrite', effects: ['keepsDataInMemory'] } },
    appGivesNonJson: { ids: ['9-7'], outcome: { next: 'beforeFirstWrite', effects: ['callFails'] } },
    firstWrite: { ids: ['9-4', '9-7'], outcome: { next: 'written', effects: ['writesWholeRecord'] } },
    keptValueChanges: { impossible: 'the record keeps nothing before the room is created or the join completes' },
    writeFails: { impossible: 'nothing is written yet' },
  },
  written: {
    appGivesRecordData: { ids: ['9-7'], outcome: { next: 'written', effects: ['writesBeforeCallReturns', 'writesWholeRecord'] } },
    appGivesNonJson: { ids: ['9-7'], outcome: { next: 'written', effects: ['callFails'] } },
    firstWrite: { impossible: 'the record is already written' },
    keptValueChanges: { ids: ['9-4'], outcome: { next: 'written', effects: ['writesWholeRecord'] } },
    writeFails: { ids: ['9-4'], outcome: { next: 'written', effects: ['goesOnFromMemory'] } },
  },
}
