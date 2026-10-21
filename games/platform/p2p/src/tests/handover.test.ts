import assert from 'node:assert/strict'
import {describe, it} from 'node:test'
import {decideSnapshot, type SnapshotDecision, type SnapshotSource} from '../handover.ts'
import {createRoomState, joinPlayer, type RoomState} from '../room-state.ts'
import {tab} from './members.ts'
import {race, type Race} from './race.ts'

// a hosts on connection a, term 0; b and c follow
const room = joinPlayer(joinPlayer(createRoomState(race, tab('a')), tab('b')), tab('c'))
// a came back on connection a2, term 1
const moved = joinPlayer(room, tab('a2', 'a'))
const asGuest = (changes: Partial<SnapshotSource> = {}): SnapshotSource => ({
  self: tab('b'),
  standing: 'following',
  restoring: false,
  hidden: false,
  known: room,
  sender: 'a',
  ...changes
})
const asReloadedCreator = (changes: Partial<SnapshotSource> = {}): SnapshotSource =>
  asGuest({self: tab('a2', 'a'), standing: 'waiting', restoring: true, known: null, sender: 'b', ...changes})

const cases: [string, RoomState<Race>, SnapshotSource, SnapshotDecision][] = [
  ['follows its host', room, asGuest(), 'follow'],
  ['follows a newer term its host hands over', moved, asGuest(), 'follow'],
  ['follows a newer term from the new connection of its creator', moved, asGuest({sender: 'a2'}), 'follow'],
  ['ignores a room of another creator', {...room, hostId: 'c'}, asGuest({sender: 'c'}), 'ignore'],
  ['ignores an older term', room, asGuest({known: moved}), 'ignore'],
  [
    'ignores the same term from another connection of the creator while following',
    joinPlayer(room, tab('a3', 'a')),
    asGuest({known: moved, sender: 'a3'}),
    'ignore'
  ],
  ['ignores a snapshot relayed by a stranger', room, asGuest({sender: 'z'}), 'ignore'],
  ['restores a reloaded creator from a member', room, asReloadedCreator(), 'restore'],
  ['restores a hidden reloaded creator', room, asReloadedCreator({hidden: true}), 'restore'],
  ['ignores a restore offer from a stranger', room, asReloadedCreator({sender: 'z'}), 'ignore'],
  [
    'ends the room when the retained reservation of the creator ran out',
    {...room, clock: 10, reservations: {a: 10}},
    asReloadedCreator(),
    'expired'
  ],
  [
    'restores while the retained reservation of the creator still holds',
    {...room, clock: 9, reservations: {a: 10}},
    asReloadedCreator(),
    'restore'
  ],
  ['keeps a hidden second tab of the creator waiting', room, asReloadedCreator({restoring: false, hidden: true}), 'ignore'],
  ['takes a room the old host hands to this connection', moved, asReloadedCreator({restoring: false, sender: 'a'}), 'restore'],
  [
    'hosts a newer room that names this connection, whoever relays it',
    joinPlayer(moved, tab('a')),
    asGuest({self: tab('a'), known: moved, sender: 'a3'}),
    'host'
  ],
  [
    'outranks a rival tab of the creator with a higher connection ID',
    joinPlayer(room, tab('a3', 'a')),
    asGuest({self: tab('a2', 'a'), standing: 'hosting', known: moved, sender: 'a3'}),
    'outrank'
  ],
  [
    'steps down to a rival tab of the creator with a lower connection ID',
    joinPlayer(room, tab('a1', 'a')),
    asGuest({self: tab('a2', 'a'), standing: 'hosting', known: moved, sender: 'a1'}),
    'follow'
  ],
  [
    'ignores a rival relayed by someone else',
    joinPlayer(room, tab('a1', 'a')),
    asGuest({self: tab('a2', 'a'), standing: 'hosting', known: moved, sender: 'b'}),
    'ignore'
  ]
]

describe('decideSnapshot', () => {
  for (const [name, snapshot, source, expected] of cases) {
    it(name, () => {
      assert.equal(decideSnapshot(snapshot, source), expected)
    })
  }
})
