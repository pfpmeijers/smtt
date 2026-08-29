# AST Validation Requirements

This specification defines post-parse validation rules for the state-machine
AST.

Scope:

- The input is the AST produced by the parse step.
- Grammar parsing and tokenization are out of scope.
- The rules below define structural and semantic constraints that must hold
  before downstream features, test steps and fixtures generation.

## Requirements

- [REQ-401] The AST document shall conform to the canonical JSON schema for
  state-machine ASTs.
- [REQ-402] State names shall be globally unique across all state machines in
  the AST.
- [REQ-403] Every precondition state reference (explicit transition state or
  default precondition state) shall resolve to a declared state in the AST.
- [REQ-404] Every state-type trigger name shall resolve to a declared state in
  the AST.
- [REQ-405] Every transition result state shall be declared in the same machine
  that owns the transition.
- [REQ-406] A state-trigger transition shall resolve to at least one candidate
  source transition from another state machine, and that source transition's
  result arguments shall satisfy the trigger argument contract.
- [REQ-416] State-triggers shall not resolve via a cyclic definition.
- [REQ-417] Data-value tables shall include a column for every attribute 
  declared in the `## Data` attribute list.
- [REQ-407] Within one transition precondition list (`states`), each state
  name shall appear at most once, regardless of arguments.
- [REQ-408] Within one transition precondition list (`states`), exactly zero
  or one state per owning machine shall be present.
- [REQ-411] When a transition references one or more arguments, at least one
  contributing machine in that transition context shall provide one or more
  example data rows for these argument(s).
- [REQ-412] Any argument using a modifier shall have a base reference to the
  same attribute name somewhere in the same effective transition context.
- [REQ-418] Every attribute value referenced in a condition (argument condition
  or implied state condition) shall be defined in the example data
  values table for that attribute.
- [REQ-413] For modifiers `not`, `other`, `different`, `unequal`, `next`, and
  `previous`, the attribute's example values pool shall contain at least two
  distinct values.
- [REQ-414] For modifiers `incremented` and `decremented`, each value for the
  referenced attribute in the example values pool shall be a finite numeric
  value.
- [REQ-415] A condition attached to a result argument shall use only an
  equality-style operator.
