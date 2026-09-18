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

Completing an AST never changes the states, triggers, or precondition lists
declared by the author, and never changes a transition's *target* state. It
only adds or fills in data attributes and example value rows — plus, for one
narrow case, a transition's own result arguments (REQ-434) — in this order:

1. Derive the example value rows from the per-attribute value lists a source
   declares in place of a combinations table (REQ-435).
2. Infer a result argument for every transition whose target state pins an
   attribute to a concrete value — a literal via `=`, or absence via
   `undefined` — that the transition does not already assign or reference
   (REQ-434).
3. Infer data attributes from every usage site (REQ-419).
4. Synthesise undefined example rows for attributes with no values (REQ-420).
5. Augment the example table with the value combinations that conditions and
   results reference (REQ-421), including the combinations implied by an
   attribute reference (REQ-426).

Step 1 runs first because every later step reads the example table: the derived
rows must be in place before anything back-fills or augments them.

Step 2 runs before the data steps because it can introduce new result arguments
that steps 3-5 must treat exactly like author-written ones: the inferred value
needs a declared attribute (REQ-419) and a place in the example table (REQ-421)
just as much as an explicit one does.

A further step, the expansion annotation below, runs after validation and adds
derived data rather than completing the model. The trigger argument binding
(REQ-438) and the transitions report (REQ-439) are derived from that same
resolution.

Each step only ever adds: an attribute already declared keeps its
description, an example row already present is never rewritten or removed,
and a result argument already present — for any reason, including one an
earlier author-written value assigns — is never replaced.

## Requirements

- [REQ-435] The complete AST shall hold, as `dataValueCombinations`, the full
  cartesian product of the per-attribute value lists in `dataValues`, when the
  raw AST carries them.

  Rationale: a `### Values` list with no `### Value combinations` table states
  that every combination of the declared values is a valid one. Which rows that
  amounts to is derived, not authored, so it belongs here rather than in the
  grammar.

  Remarks: the product is laid out with the last-declared attribute varying
  fastest, so the rows read in the order the `### Values` list suggests.
  Duplicate values within one attribute's list count once. A list may name
  `undefined`, which reaches `dataValues` as `""` and combines like any other
  value. `dataValues` is
  itself left in place — it is what the source declared, and completion only
  adds.

  The product shall not exceed 1000 rows, and no attribute's value list shall
  be empty; either is an error naming the offending machine. A handful of value
  lists multiply into a scenario count no test run would finish, so an
  over-large expansion is refused rather than attempted — the author reduces
  the lists, or spells the rows out in a `### Value combinations` table.

- [REQ-434] The complete AST shall assign, on a transition's own result, every
  attribute that the transition's target state pins to a concrete value via a
  literal `=`, a literal `as`, or an `undefined` implied condition, unless the
  transition's result already carries an argument for that attribute (a
  literal, a reference, or an explicit `set to undefined`). The synthesized
  argument sets the attribute to the target state's literal for `=` and `as`,
  or to undefined (no `value`, as `set to undefined` itself parses) for
  `undefined`.

  A state's implied conditions describe every occurrence of that state
  (REQ-433 in `smtt.parse.validate.md`), so either of these holds on arrival
  regardless of what the transition's preconditions otherwise carry: an
  author who leaves such an attribute unset in the result is stating the
  obvious, not omitting information the model needs. `undefined` is included
  precisely because it is as much an equality as `=` is — it pins the
  attribute to the single value "absent" — and a literal `as` because, for a
  fixed value, sameness and equality coincide. An `as` naming another
  attribute pins no literal (its value follows the referenced attribute per
  row) and is left alone, as is `defined`, which pins no single
  value (any defined value satisfies it) and so has nothing for this step to
  assign; a target declaring `defined` remains a REQ-433 validation check
  only.

  This step never overrides an explicit result. A transition whose own result
  already sets the attribute — even to a value that contradicts the target —
  is left exactly as authored, and REQ-433 continues to flag that
  contradiction: it reflects a decision the author actually wrote down, not a
  gap this step should paper over.

- [REQ-419] The complete AST shall declare a data attribute for every
  attribute referenced anywhere in the machine: `dataValueCombinations` column
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

  The annotation references sources rather than copying them: each source's
  result is the intermediate result the chain passes through (REQ-146 in
  `smtt.generate.features.md`), so a transition keeps its single `result`.

- [REQ-438] A state trigger's argument shall denote the value its resolving
  source's result sets it to, when that result sets the attribute: the
  argument is then *bound* to the source's `resulting $attribute-name` column.

  Rationale: an expansion chain spans several moments, and a single attribute
  name holds a value before the event and one after each link that sets it.
  The trigger fires on the state the source *produces*, so its argument means
  the produced value, not the one the attribute held before.

  Remarks:
  - An argument the source's result does not set carries its value over
    (REQ-430) and stays unbound, as does a modified argument, which resolves
    against its own derived column.
  - The binding applies per link: a source's own trigger is bound by the
    source before it in the chain, and the innermost source, driven by an
    event, binds nothing.
  - A result reference to a bound attribute reads the bound column (REQ-437 in
    `smtt.generate.features.md`); a precondition on the attribute still tests
    the value before the event.
  - Like the annotation, the binding is derived: it follows from the chain and
    the sources' results, so it is not recorded in the AST.

  Example: `Default user identity available` with `default email address` set
  to `user email address`, triggered by `User authenticated` with `user email
  address`, resolved by a source whose result sets `user email address` to
  `reservation email address`. The trigger argument is bound to `resulting user
  email address`, so the default email address becomes the reservation email
  address, even though the scenario starts with the user unauthenticated and
  `user email address` undefined.

## Transitions report

With `--debug`, the parse step writes `transitions.txt` beside the AST: every
transition with the expansion tree that reaches it.

- [REQ-439] A fully expanded path in the report shall show what its generated
  scenario asserts: the merged `Given` states, the resolved event, one result
  per transition along the chain — innermost first, prefixed with that
  transition's id, and with references read through its bindings (REQ-438) —
  and the `Examples:` table with only the columns the scenario's steps render
  (REQ-436 in `smtt.generate.features.md`).

  Rationale: the report explains why a scenario came out the way it did, so it
  shall not show a result or a column the scenario lacks, nor omit one it has.

  Example:
  ```text
  🢂️ [008.2]
      ✅ `default user identity unavailable`
      ...
      ➡️ `painting reservation confirmed` using `reservation email address`, `reservation contact name`
      ⏩ [039a] `painting reserved` with `resulting painting assignee email address` set to `reservation email address`, ...
      ⏩ [074] `user authenticated` with `resulting user email address` set to `reservation email address`
      ⏩ [008] `default user identity available` with `resulting default email address` set to `resulting user email address`
  ```

- [REQ-441] The report's `Examples:` table shall list every surviving row, with
  rows that are equivalent under REQ-440 (`smtt.generate.features.md`) grouped
  together and marked by what the generated scenario does with them.

  Remarks:
  - Groups are listed in order of their first row, and the rows in a group keep
    table order.
  - A group of two or more rows is bracketed by `┌`, `│` and `└`. Its first row
    is kept and marked `►`, and every other row is pruned and marked `X`.
  - A row equivalent to no other row gets no mark.
  - The rows without an `X` are exactly the rows of the generated scenario.

  Example:
  ```text
      Examples:
        | email | name   |
      ┌►| user1 | User A |
      │X| user1 | User B |
      │X| user2 | User A |
      └X| user2 | User B |
  ```

## Related specifications

- `smtt.parse.validate.md` — the constraints that shall hold of the raw AST
  and of the complete AST, including the reference rules (REQ-424, REQ-425)
  the requirements above build on.
- `sm.spec.md` — the authoring notation these requirements complete.
