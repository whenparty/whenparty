type State = 'open, with a TURN secret' | 'open, without a TURN secret'

type Event = 'the page sends a request for TURN credentials'

type Answer = 'the two addresses of 8-2 and new credentials that expire 86,400 seconds after the answer' | 'an empty answer'

type Outcome = {readonly answer: Answer}

type Cell = {readonly ids: readonly string[]; readonly outcome: Outcome} | {readonly impossible: string}

export const table: {readonly [S in State]: {readonly [E in Event]: Cell}} = {
  'open, with a TURN secret': {
    'the page sends a request for TURN credentials': {
      ids: ['8-1', '8-2'],
      outcome: {answer: 'the two addresses of 8-2 and new credentials that expire 86,400 seconds after the answer'}
    }
  },
  'open, without a TURN secret': {
    'the page sends a request for TURN credentials': {
      ids: ['8-1'],
      outcome: {answer: 'an empty answer'}
    }
  }
}
