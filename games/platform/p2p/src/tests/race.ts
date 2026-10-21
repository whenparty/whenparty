import type {GameRules} from '../room-state.ts'

type Player = 'A' | 'B'

export interface Race {
  total: number
  turn: Player
  winner: Player | null
}

const isPlayer = (value: unknown): value is Player => value === 'A' || value === 'B'

const isStep = (value: unknown): value is number => value === 1 || value === 2

const isRace = (value: unknown): value is Race => {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const {total, turn, winner} = value as Record<string, unknown>

  return Number.isInteger(total) && isPlayer(turn) && (winner === null || isPlayer(winner))
}

export const race: GameRules<Race, number> = {
  seats: ['A', 'B'],
  createState: () => ({total: 0, turn: 'A', winner: null}),
  applyMove: (state, seat, step, {occupiedSeats}) => {
    if (occupiedSeats.length < 2 || state.winner || seat !== state.turn || !isStep(step)) {
      return null
    }

    const total = state.total + step

    return {total, turn: state.turn === 'A' ? 'B' : 'A', winner: total >= 5 ? state.turn : null}
  },
  isOver: state => state.winner !== null,
  isMove: isStep,
  isState: isRace
}
