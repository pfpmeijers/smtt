# AST Validation Requirements

This specification defines validation rules for the state-machine AST.

Scope:

- The input is the AST produced by the parse step.
- Grammar parsing and tokenization are out of scope.
- The rules below define structural and semantic constraints that must hold
  before downstream features, test steps and fixtures generation.

## AST flavors

Validation is defined over two flavors of the AST, produced in sequence:

1. **Raw AST** — the (potentially minimized) AST as produced directly by
   parsing the source markdown. Authors may omit attributes, declarations, or
   example values whose meaning is implied by usage elsewhere in the
   document.
2. **Complete AST** — the raw AST after every implicit data semantic has been
   translated into an explicit one: every attribute referenced anywhere is
   declared, every declared attribute has at least one example value, and
   every value referenced by a condition is present among that attribute's
   example values.

Completing the AST never changes its structural skeleton — states,
transitions, triggers, and precondition lists are exactly as declared by the
author. It only adds or fills in data attributes and example value rows.
Constraints that concern that structural skeleton therefore hold on the raw
AST already; constraints that concern data attributes and their example
values are only guaranteed once the AST is complete.

## Pipeline overview

```
1. Parse markdown → raw AST
2. Validate raw AST
3. Classify triggers
4. Classify condition value references
5. Complete AST
   a. Infer data attributes from every usage site
   b. Synthesise undefined example rows for attributes with no values
   c. Augment the example table with condition-referenced value combinations
6. Validate the complete AST
```

Step 4 mirrors step 3's disambiguation: a condition value that
case-insensitively matches an attribute name already registered on its own
machine (declared under `## Data`, or used anywhere else in the machine) is
classified as a reference to that attribute (`condition.valueIsReference`)
rather than a literal — the same "match against known names" approach step 3
already uses to tell an event trigger apart from a state trigger. It must run
before step 5, since step 5's own sub-steps (5a, 5c) treat a
reference-classified condition differently from a literal one.

## Raw AST validation

The following requirements shall hold on the raw AST. They describe the
structural and referential integrity of states, transitions, triggers, and
argument shapes — properties that are fully determined by parsing and are
unaffected by completion.

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

- [REQ-407] Within one transition precondition list (`states`), each state
  name shall appear at most once, regardless of arguments.

- [REQ-408] Within one transition precondition list (`states`), exactly zero
  or one state per owning machine shall be present.

- [REQ-412] Any argument using a modifier shall have a base reference to the
  same attribute name somewhere in the same effective transition context.

- [REQ-415] A condition attached to a result argument shall use only an
  equality-style operator.

- [REQ-416] State-triggers shall not resolve via a cyclic definition.

- [REQ-424] A condition classified as an attribute reference
  (`condition.valueIsReference`) shall only appear on a result argument's
  condition. State implied conditions, default-precondition arguments,
  transition state arguments, and transition trigger arguments reject a
  reference-classified condition value.

## Complete AST validation

The following requirements describe the guarantees that hold of the complete
AST: every attribute used anywhere is declared, every declared attribute has
at least one example value, and every condition-referenced value is present
among an attribute's example values. These constraints are about the `data`
map and `dataExampleValues` table, both of which raw AST authors may leave
partially or entirely unspecified.

- [REQ-417] Every `dataExampleValues` row in the complete AST shall include a
  column for every attribute present in the machine's `data` map.

- [REQ-418] Every attribute value referenced in a condition (argument
  condition or implied state condition) shall be present in the example data
  values table for that attribute.

- [REQ-411] When a transition references one or more arguments, at least one
  contributing machine in that transition context shall provide one or more
  example data rows for these argument(s).

- [REQ-413] For modifiers `not`, `other`, `different`, `unequal`, `next`, and
  `previous`, the attribute's example values pool shall contain at least two
  distinct values.

- [REQ-414] For modifiers `incremented` and `decremented`, each value for the
  referenced attribute in the example values pool shall be a finite numeric
  value.

- [REQ-419] The complete AST shall declare a data attribute for every
  attribute referenced anywhere in the machine: `dataExampleValues` column
  names, state implied-condition attribute names, default-precondition
  argument names, and transition state/event-trigger/result argument names.
  State-trigger arguments are excluded because they belong to the triggering
  machine, not the current one. A result argument whose condition is an
  attribute reference (REQ-423/REQ-424) is likewise excluded for that
  occurrence: its value is never drawn from its own example values, only
  resolved dynamically from the referenced attribute. An attribute declared
  only through inference carries an empty description.

- [REQ-420] Every declared data attribute shall have at least one example
  value. When an attribute has no example values, the complete AST shall
  provide a row representing an undefined/absent value (`""`) for every
  attribute. Every row in the table shall include every declared attribute as
  a column, with `""` standing in for any attribute absent from that row.

- [REQ-421] Every value referenced by a condition (argument condition or
  implied state condition) shall be present among the example values for that
  attribute. When a context (e.g. a single transition) constrains multiple
  attributes at once, each required combination of values across those
  attributes shall be satisfied by at least one row. A condition classified as
  an attribute reference (REQ-423) contributes no required value: it pins no
  literal, so the referenced attribute name is never mistaken for one.
