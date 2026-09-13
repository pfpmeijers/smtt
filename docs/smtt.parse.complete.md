# AST Completion Requirements

This specification defines how a raw state-machine AST is completed into a
complete AST.

Scope:

- The input is the raw AST produced by the parse step.
- The output is the complete AST: the same structural skeleton, with every
  implicit data semantic made explicit.
- Validation of either AST flavor is out of scope; see
  `smtt.parse.validate.md`, which also defines both flavors and the pipeline
  the completion step sits in.
- Completion is application independent. It states what the model itself
  implies, never what a downstream consumer (features, test steps, fixtures)
  happens to need.

## What completion changes

Completing an AST never changes its structural skeleton — states,
transitions, triggers, and precondition lists are exactly as declared by the
author. It only adds or fills in data attributes and example value rows, in
this order:

1. Infer data attributes from every usage site (REQ-419).
2. Synthesise undefined example rows for attributes with no values (REQ-420).
3. Augment the example table with the value combinations that conditions and
   results reference (REQ-421), including the combinations implied by an
   attribute reference (REQ-426).

A fourth step, the expansion annotation below, runs after validation and adds
derived data rather than completing the model.

Each step only ever adds: an attribute already declared keeps its
description, and an example row already present is never rewritten or
removed.

## Requirements

- [REQ-419] The complete AST shall declare a data attribute for every
  attribute referenced anywhere in the machine: `dataExampleValues` column
  names, state implied-condition attribute names, default-precondition
  argument names, and transition state/event-trigger/result argument names.
  State-trigger arguments are excluded because they belong to the triggering
  machine, not the current one. A result argument whose result is an
  attribute reference (REQ-424) is likewise excluded for that
  occurrence: its value is never drawn from its own example values, only
  resolved dynamically from the referenced attribute. An argument constrained
  by a reference-valued *condition* (REQ-426) is not excluded: the constrained
  attribute belongs to this machine's attribute space like any other
  argument — only its value follows from the referenced attribute — so such
  an occurrence declares it. An attribute declared only through inference
  carries an empty description.

- [REQ-420] Every declared data attribute shall have at least one example
  value. When an attribute has no example values, the complete AST shall
  provide a row representing an undefined/absent value (`""`) for every
  attribute. Every row in the table shall include every declared attribute as
  a column, with `""` standing in for any attribute absent from that row.

- [REQ-421] Every value referenced by a condition or result (argument
  condition, argument result, or implied state condition) shall be present
  among the example values for that attribute. When a context (e.g. a single
  transition) constrains multiple attributes at once, each required
  combination of values across those attributes shall be satisfied by at
  least one row. A condition or result classified as an attribute reference
  (REQ-424) contributes no required value: it pins no literal, so the
  referenced attribute name is never mistaken for one. What a reference
  condition does contribute is the linked requirement of REQ-426.

- [REQ-426] An equality *filter* on an attribute reference (`` `attr1` =
  `attr2` ``, or the `is` spelling) shall imply example values for the
  constrained attribute: the complete AST shall hold, per defined value of the
  referenced attribute, a row in which the constrained attribute holds that
  same value. The constrained attribute is thereby implicitly defined from the
  attribute it references, without the author declaring any example value for
  it. When the surrounding context already pins the referenced attribute to
  one value, only that value is implied. When the referenced attribute has no
  defined value in this machine — it is declared by another state machine —
  nothing is implied: this machine's own table holds no value to copy.

  This exists because `=` *searches*: it can only ever hold if a row in which
  the two attributes coincide exists, so completion supplies one.

  `as` implies no row. It states sameness rather than comparison, and the
  generator gives the constrained attribute the referenced value outright
  (REQ-432 in `smtt.generate.features.md`) — there is no row to find it in, so
  none has to be manufactured.

  The remaining comparison operators state what a value must *not* be
  (`<>`, `is not`), or an open-ended relation (`<`, `>`, `<=`, `>=`), so no
  single value follows from them and they imply no row.

## Expansion annotation

A state trigger states *what* makes a transition fire, not *which* transition
produced that state. Resolving it is a property of the parsed model (REQ-430),
so the parse step records the answer rather than leaving every consumer to
work it out again.

This runs on the validated AST, after the completion steps above: it adds no
attribute and no example row, only the resolution it already performs while
validating.

- [REQ-431] Every state-triggered transition shall carry the chains of source
  transitions explaining its trigger: one chain per resolved path (REQ-430),
  each ordered innermost first — the chain's first source carries the event
  trigger that starts it, and its last source produces the state the
  transition's own trigger names. A source shall be referenced by its
  declaring state machine and its index within that machine's own transitions,
  since a transition id is optional.

  An event-triggered transition shall carry no annotation. A state trigger
  that nothing explains shall carry an empty list, which says the resolution
  ran and found no source, as opposed to not having run.

  The annotation is derived data. An AST carrying it and the same AST without
  it describe the same state machines: a consumer that finds no annotation
  resolves the trigger itself (REQ-430) and reaches the same answer.

## Related specifications

- `smtt.parse.validate.md` — the constraints that shall hold of the raw AST
  and of the complete AST, including the reference rules (REQ-424, REQ-425)
  the requirements above build on.
- `sm.spec.md` — the authoring notation these requirements complete.
