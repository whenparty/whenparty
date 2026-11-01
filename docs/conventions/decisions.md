# Decision records

A decision record explains why a choice was made. Write one when a rejected option also had real advantages and the reason it lost is not stated in the code, the specification or the conventions files. Without the record, an agent who reads only those could propose that option again. Such a reason is often how a tool behaves, or a need that the repository expects to have, such as tests it does not have yet. A fact stated in another document does not replace the record, because only a record weighs the options. A choice that a conventions file states as a rule, such as how documents look, needs no record: the [Decisions section](/docs/conventions/workflow.md#decisions) of the workflow already makes the agent follow the rule and leaves a change to it to the user. A record describes the decision in force. When the decision changes, rewrite the record. When it no longer applies, delete it. Git keeps earlier versions.

- Records about a [project](/docs/glossary.md#project) live in that project's `docs/decisions/`, and all other records in the root `docs/decisions/`.
- Name a record after its subject, such as `separate-deployments.md`, without numbers or dates. One record covers one decision.
- A record does not retell the discussion.
- A record has these sections:
  - Context: the problem, every fact that weighs on the choice, and links to the records this decision depends on.
  - Options: every option considered, including the previous decision when there was one, each with its advantages and drawbacks.
  - Decision: the chosen option and why it outweighs the others.
  - Consequences: links to the rules, requirements and code that follow from the decision, without restating them.
- Accepted changes to a specification that are not made yet belong in the `docs/PLANNED.md` of its project or [module](/docs/glossary.md#module), as the [specification rules](/docs/conventions/specs.md) describe.
