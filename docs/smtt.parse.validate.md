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
   - Classify condition/result value references (backtick vs. quote/number)
2. Validate raw AST
3. Classify triggers
4. Complete AST (specified in `smtt.parse.complete.md`)
   a. Infer a result assignment for transitions landing in a state whose
      implied condition pins an attribute to a concrete value (a literal via
      `=`, or absence via `undefined`)
   b. Infer data attributes from every usage site
   c. Synthesise undefined example rows for attributes with no values
   d. Augment the example table with condition/result-referenced value
      combinations
5. Validate the complete AST
6. Annotate state triggers with their resolved expansion chains
   (specified in `smtt.parse.complete.md`)
```

Reference classification is not a separate pipeline step: a condition or
result value's `valueIsReference` is set directly by the grammar while
parsing (step 1), purely by delimiter — a backticked value is a reference, a
double-quoted or bare numeric value is a literal — with no name-matching
involved. This differs from trigger classification (step 3), which *is* a
genuine post-parse step: it matches each trigger's name against every known
state name (collected across all parsed machines) to decide `state` vs.
`event`, which is why it must run after every file has been parsed.

## Raw AST validation

The following requirements shall hold on the raw AST. They describe the
structural and referential integrity of states, transitions, triggers, and
argument shapes — properties that are fully determined by parsing and are
unaffected by completion.

- [REQ-401] The AST document shall conform to the canonical JSON schema for
  state-machine ASTs.

- [REQ-402] State names shall be globally unique across all state machines in
  the AST.

- [REQ-409] The state machine owning a state name shall be the one whose
  `states` array holds an entry with that name, matched case-insensitively.
  A name declared by more than one machine shall not resolve to either of
  them: the lookup shall report the ambiguity instead. REQ-402 makes such a
  name an error, so an ambiguity reaching the lookup is an internal
  inconsistency, not an authoring case.

- [REQ-403] Every precondition state reference (explicit transition state or
  default precondition state) shall resolve to a declared state in the AST.

- [REQ-404] Every state-type trigger name shall resolve to a declared state in
  the AST.

- [REQ-405] Every transition result state shall be declared in the same machine
  that owns the transition.

- [REQ-406] A state trigger naming a state that transitions do produce shall
  have at least one producing transition able to act as its source: one whose
  result satisfies the trigger's arguments and whose own precondition states do
  not conflict with the referring transition's (REQ-430). Otherwise nothing in
  the model can make the transition fire. This holds along the whole chain: a
  trigger that resolves only through a source whose own trigger is unresolvable
  is unresolvable itself.

  A trigger naming a state no transition produces at all is not covered here —
  it then has no source rather than an incompatible one, which a consumer
  reports as it sees fit.

- [REQ-407] Within one transition precondition list (`states`), each state
  name shall appear at most once, regardless of arguments.

- [REQ-408] Within one transition precondition list (`states`), exactly zero
  or one state per owning machine shall be present.

- [REQ-412] Any argument using a modifier shall have a base reference to the
  same attribute name somewhere in the same effective transition context.

- [REQ-415] A result argument's value shall always be a plain equality
  assignment (`attribute set to value`) — guaranteed structurally by the
  schema, since `Result` (unlike `Condition`) carries no `operator` field to
  choose a non-equality comparison with.

- [REQ-416] State-triggers shall not resolve via a cyclic definition.

- [REQ-145] A range condition's `value` shall be a single string holding both
  bounds with the bracket characters the author wrote, e.g. `[1, 4)`. The
  brackets carry each bound's inclusivity — `[` and `]` include the bound, `(`
  and `)` exclude it — which nothing else in the condition records. A range
  shall carry at least one square bracket: `[low, high]`, `[low, high)` and
  `(low, high]` are ranges, while the symmetric `(low, high)` is the set form
  (`in` with a list of values), since both forms share the `in` operator and
  the brackets are what tell them apart.

- [REQ-424] A value shall be classified as an attribute reference
  (`valueIsReference`) by its delimiter alone: a backticked condition or
  result value names another
  data attribute, a double-quoted or bare numeric value is a literal. No name
  matching is involved. A reference shall denote the value the named attribute
  holds in the same `dataValueCombinations` row: a result assigns its attribute
  that value, a condition compares its attribute against it. A reference shall
  only appear where a single example-values row can resolve it: on a result
  argument's `result`, or on a condition using a scalar comparison operator
  (`=`, `<>`, `<`, `>`, `<=`, `>=`) or the sameness operator `as`. A set (`in`, `not in`),
  range (`in range`, `not in range`), or unary (`undefined`, `defined`)
  condition rejects a reference-classified value: it compares against a fixed
  list of literals, or against no value at all, which a dynamically resolved
  reference cannot provide.

## Complete AST validation

The following requirements shall hold on the complete AST. They constrain the
`data` map and the `dataValueCombinations` table, both of which raw AST authors
may leave partially or entirely unspecified.

What the completion step itself adds to reach that state — inferred result
assignments (REQ-434), attribute inference (REQ-419), synthesised undefined
rows (REQ-420), and augmented value combinations (REQ-421, REQ-426) — is
specified separately, in `smtt.parse.complete.md`. The requirements below are
checks on the result, whether it was produced by that step or supplied
ready-made.

- [REQ-417] Every `dataValueCombinations` row in the complete AST shall include a
  column for every attribute present in the machine's `data` map.

- [REQ-418] Every attribute value referenced in a condition or result
  (argument condition, argument result, or implied state condition) shall be
  present in the example data values table for that attribute.

- [REQ-429] A condition shall be evaluated against a single attribute value:
  `=` holds when the two values are equal — numerically when both are
  numeric, textually otherwise — and `<>` when they are not; the
  ordering operators `<`, `>`, `<=` and `>=` hold only between numeric values;
  `in` and `not in` test membership of the listed values; `in range` and
  `not in range` test the bounds and their inclusivity (REQ-145); `defined` and
  `undefined` test presence. An absent value — an empty cell or a missing
  column — shall satisfy `undefined` only, and never any comparison.

  `as` is not evaluated here: it states sameness and is applied as a binding
  before any condition is tested (REQ-432 in `smtt.generate.features.md`). It
  is evaluated as an equality only where a binding cannot serve — an `as`
  carrying a modifier, and structural expansion matching, which has no example
  row to bind against.

- [REQ-430] A state trigger shall resolve to those transitions whose result
  state name equals the trigger's state name and whose result is compatible
  with the trigger's arguments: per shared attribute the modifiers shall be
  equal, and where the source assigns a value and the
  trigger carries a condition, that value shall satisfy the condition
  (REQ-429). A trigger argument the source's result does not declare is
  satisfied when the source references that attribute anywhere else — in its
  own precondition states or its own trigger. A candidate whose own
  precondition states pin a different state of a machine the referring
  transition also pins is not a resolution, unless the candidate's own trigger
  reaches that machine again. Resolution is structural: it never consults
  example values.

- [REQ-411] When a transition references one or more arguments, at least one
  contributing machine in that transition context shall provide one or more
  example data rows for these argument(s).

- [REQ-413] For the `next` and `previous` modifiers, the attribute's example
  values pool shall contain at least two distinct values.

- [REQ-414] For modifiers `incremented` and `decremented`, each value for the
  referenced attribute in the example values pool shall be a finite numeric
  value.

- [REQ-425] Every attribute-reference value — a condition's as well as a
  result's — shall name a data attribute declared in some state machine of
  the AST. The declaring machine need not be the one owning the
  reference: a reference is resolved against whichever machine declares that
  name. Naming an attribute that exists nowhere is an error. The check runs on
  the complete AST, so an attribute declared only by inference (REQ-419)
  counts as declared.

- [REQ-433] A transition shall leave its target state's own implied conditions
  satisfied. A state's implied conditions describe every occurrence of that
  state, so a transition landing in it owes them: the value the transition
  leaves an attribute holding — assigned by its own result, or otherwise
  carried over from its preconditions — shall not contradict what the target
  state declares about that attribute.

  Only statically decidable contradictions are errors:

  - the target declares `defined` and the transition leaves the attribute
    undefined, or declares `undefined` and the transition leaves it set;
  - the target declares `` = `` a literal and the transition leaves a
    different literal, or leaves the attribute undefined.

  An attribute whose post-transition value nothing determines — no result
  assignment, and no precondition that settles its presence — is not reported,
  nor is one whose preconditions disagree: the transition does not settle it,
  so nothing follows. Ordering, set and range declarations are likewise not
  reported, since whether they hold depends on the row.

  A sameness (`as`) declaration on the target state is never owed: it binds
  rather than demands (REQ-432 in `smtt.generate.features.md`), so the
  generator satisfies it by construction.

  Without this check a contradiction surfaces only much later — as an empty
  examples table in some other machine that expanded through the transition —
  or not at all, when the attribute happens to go unused.

  On the complete AST, the `` = `` literal and `undefined` cases are reachable
  only through a transition's own explicit result: completion (REQ-434 in
  `smtt.parse.complete.md`) already gives any transition that would otherwise
  leave the attribute unassigned or merely carried over a result matching the
  target's concrete value. So by the time this check runs, either contradiction
  means the author's own result explicitly names a conflicting value (or
  explicitly leaves/sets the attribute the wrong way) — never an omission.
  Only the `defined` case is unaffected: REQ-434 assigns no value for it,
  since it pins none, so it remains reachable through an unset or
  precondition-carried attribute exactly as described above.
