# Decision records

A decision record explains why a choice was made when the code, the specification and the conventions cannot show it and a rejected option also had real advantages. It describes the decision in force. When the decision changes, rewrite the record. When it no longer applies, delete it. Git keeps earlier versions.

- Records about the whole repository live in the root `docs/decisions/`, records about a [project](/docs/glossary.md#project) in that project's `docs/decisions/`.
- Name a record after its subject, such as `separate-deployments.md`, without numbers or dates. One record covers one decision.
- A choice whose alternatives had no real advantage needs no record. A record does not retell the discussion.
- A record has these sections:
  - Context: the problem, every fact that weighs on the choice, and links to the records this decision depends on.
  - Options: every option considered, including the previous decision when there was one, each with its advantages and drawbacks.
  - Decision: the chosen option and why it outweighs the others.
  - Consequences: links to the rules, requirements and code that follow from the decision, without restating them.
- Accepted changes to a specification that are not made yet belong in the `docs/PLANNED.md` of its project or [module](/docs/glossary.md#module), as the [specification rules](/docs/conventions/specs.md) describe.
