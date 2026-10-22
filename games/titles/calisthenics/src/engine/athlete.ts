// An athlete's characteristics, energy and the plan that trains them
export const characteristics = ['arms', 'chest', 'back', 'legs', 'abs', 'balance', 'stamina'] as const
export type Characteristic = (typeof characteristics)[number]
export type Levels = Record<Characteristic, number>
export type Counts = Partial<Levels>

export const maxLevel = 10
export const maxEnergy = 100
export const actionsPerPlan = 3
export const trainingCost = 25
export const restGain = 50

export interface Plan {
  training: Counts
  rest: number
}

export type PlanProblem = 'actions' | 'energy' | 'level'

export interface Condition {
  levels: Levels
  energy: number
}

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0)

export const startingCondition = (): Condition => ({
  levels: Object.fromEntries(characteristics.map(each => [each, 0])) as Levels,
  energy: maxEnergy
})

export const emptyPlan = (): Plan => ({training: {}, rest: 0})

export const trainingsOf = (plan: Plan) => sum(characteristics.map(each => plan.training[each] ?? 0))

export const actionsOf = (plan: Plan) => trainingsOf(plan) + plan.rest

export const energyAfter = (energy: number, plan: Plan) =>
  Math.min(maxEnergy, energy - trainingCost * trainingsOf(plan) + restGain * plan.rest)

export const planProblem = ({levels, energy}: Condition, plan: Plan): PlanProblem | null => {
  if (actionsOf(plan) !== actionsPerPlan) {
    return 'actions'
  }

  if (trainingCost * trainingsOf(plan) > energy) {
    return 'energy'
  }

  return characteristics.some(each => levels[each] + (plan.training[each] ?? 0) > maxLevel) ? 'level' : null
}

export const applyPlan = ({levels, energy}: Condition, plan: Plan): Condition => ({
  levels: Object.fromEntries(characteristics.map(each => [each, levels[each] + (plan.training[each] ?? 0)])) as Levels,
  energy: energyAfter(energy, plan)
})

// The plan without characteristics it does not train
export const trimPlan = (plan: Plan): Plan => ({
  training: Object.fromEntries(characteristics.filter(each => plan.training[each]).map(each => [each, plan.training[each]])),
  rest: plan.rest
})
