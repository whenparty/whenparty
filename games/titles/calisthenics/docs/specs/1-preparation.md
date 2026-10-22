# Preparation

- `1-1` An athlete has seven characteristics: arms, chest, back, legs, abs, balance and stamina. At the start of the championship each characteristic is at level 0, energy is 100 and the athlete has 0 championship points. Levels range from 0 to 10, energy from 0 to 100.
- `1-2` Before each challenge the player makes a plan of three actions. An action trains one characteristic or rests. A plan can train the same characteristic more than once.
- `1-3` A training raises its characteristic by 1 level and costs 25 energy. A rest restores 50 energy. Trainings are paid from the energy the athlete has before the plan, and rests are added after them: with energy E, T trainings and R rests, energy after the plan is min(100, E − 25·T + 50·R). The order of actions in a plan does not matter. With energy 50, two trainings and one rest leave 50.
- `1-4` A plan can be confirmed only when it has three actions, costs no more than the energy before it, and raises no characteristic above 10. With energy 25, a plan with two trainings cannot be confirmed. Three rests can always be confirmed.
- `1-5` While planning, the player sees the current challenge's name, the athlete's levels and energy, and the energy after the plan. The challenge's requirements are not shown.
- `1-6` A confirmed plan cannot be changed. All confirmed plans apply when the challenge starts ([3-3](3-match.md)), each exactly once, also when a player reloads the page.
- `1-7` A plan that is not confirmed is lost when its player reloads the page.
- `1-8` Only plans change levels and energy. Levels and energy carry over between challenges unchanged.
- `1-9` During preparation every player sees each athlete's levels and energy and whether its plan is confirmed, but not other athletes' plans.
