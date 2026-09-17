# SMTT Gherkin Feature Generation

> **Notation** — AST paths use `[*]` as a wildcard array index (any element).
> A named index such as `[i]` or `[j]` is used when the surrounding text needs
> to reference a specific position. Template placeholders for AST-sourced values
> use `$name` notation (hyphenated for multi-word names, e.g. `$state-name`).

- [REQ-001] The generator shall write one feature file per state machine in the
  AST file.

- [REQ-002] The feature file shall be named
  `features/$state-machine-name.feature`.

- [REQ-003] The `$state-machine-name` shall be taken from AST path `[i].name`.

- [REQ-131] The file name `$state-machine-name` shall have remaining internal
  whitespace replaced by hyphens (`-`).

## Feature block

- [REQ-004] The feature file shall start with a `Feature` block header.

- [REQ-005] The feature file shall include the state machine overview as an
  indented description block when present.

```gherkin
Feature: $state-machine-name
  $overview
```

- [REQ-006] The `$overview` shall be taken from AST path `[i].overview`.

- [REQ-008] The overview shall be omitted when `overview` is `null`.

## Scenario label

- [REQ-009] The generator shall write one or more scenarios per transition with
  the following label:

```gherkin
Scenario: [$id] $original-state-name → $result-state-name; when $trigger; given $context-states
```

- [REQ-010] The transition shall be taken from AST path `[i].transitions[j]`.

The transition's precondition ("from") state — referred to as the "own state" —
is the state belonging to the current state machine. It is resolved from these
sources, in order of precedence:

1. **Explicit transition state**: the entry in `[i].transitions[j].states` whose
   name matches one of the machine's defined state names (`[i].states[*].name`).
2. **Default precondition**: when the transition's `states` array contains no
   match for the current machine, a default precondition from
   `[i].defaultPreconditions` whose state belongs to the current machine.
3. **Implied initial state**: when neither the transition nor default
   preconditions supply a state from the current machine, the machine's initial
   state is implied — taken from `[i].initialState`, or when that is not
   explicitly defined, the first entry in `[i].states`.

The scenario label shall be composed of the following parts:

- [REQ-011] The label shall include `[$id]`, the transition id.
  - [REQ-012] The `$id` shall be taken from AST path `[i].transitions[j].id`.

- [REQ-013] The label shall include `$original-state-name`, i.e. the state
  machine's own "from" state for this transition.
  - [REQ-014] The `$original-state-name` shall be taken from AST path
    `[i].transitions[j].states[k].name`, where `k` is the index of the own state
    in the transition's state array.
  - [REQ-015] The `$original-state-name` state shall be identified by matching
    each entry's name against the state machine's defined state names taken from
    AST path `[i].states[*].name`, where `i` is the index of the state machine
    the scenario belongs to.

- [REQ-017] The label shall include ` → $result-state-name`, the state
  machine's "to" state for this transition.
  - [REQ-018] The `$result-state-name` shall be taken from AST path
    `[i].transitions[j].result.name`.

- [REQ-019] The label shall include `; when $trigger`, the trigger name, being
  an event or a state entered of another state machine.
  - [REQ-020] The `$trigger` shall be taken from AST path
    `[i].transitions[j].trigger.name`.

- [REQ-021] The label shall include `; given $context-states`, all precondition
  states other than the own state.
  - [REQ-022] The `$context-states` shall be rendered as a comma-separated
    list.
  - [REQ-023] The `$context-states` shall be listed in the same order as the
    `Given` steps: default preconditions first (in their array order), then
    explicit transition states (excluding the own state, in their array order).
  - [REQ-024] The `; given $context-states` part shall be omitted when there
    are no context states.
  - [REQ-025] The context states shall be taken from AST paths
    `[i].transitions[j].states[*].name` (except for the own state entry), and
    `[i].defaultPreconditions[*].state`.

- [REQ-026] Where any state or the trigger carries arguments, those arguments
  shall be appended to the name inline — see [State Arguments](#state-arguments)
  for the format.

- [REQ-027] The inline argument appending shall apply to all name slots in the
  label: `$original-state-name`, `$trigger`, `$result-state-name`, and the
  other names within `$context-states`.

- [REQ-028] The scenario label part following the ID shall be rendered in
  lower case. Lower-casing applies to textual name tokens (state names, trigger
  names, qualifier words, attribute names).

- [REQ-159] The scenario label shall be truncated to a maximum of 200
  characters. The transition ID (`[$id]`) ensures uniqueness regardless of
  truncation. Truncation shall occur at the end, and appended with `...` suffix.

Example:
```gherkin
Scenario: [REQ-003] Item available → item in cart; when item added to cart; given user session present
```

For state trigger based transitions with multiple expansion paths, additional
label formatting rules apply — see [State Trigger Expansion](#state-trigger-expansion)
(REQ-029, REQ-030, REQ-031).

## Steps block

The scenario steps shall be generated from the transition information:

- `Given`: transition precondition states
  - [REQ-032] All states shall be translated into precondition steps:
    - The first step uses the keyword `Given`.
    - Subsequent steps use `And`.
    - Each step is formatted as `Given|And initially $state-name [$arguments]`.

  - [REQ-035] The precondition steps shall be emitted in effective state array
    order: the state machine's default preconditions first (in their declared
    array order), then the implied initial state (REQ-132) — a synthetic 
    fallback used only when no state else already represents the owning 
    state machine, then the transition's own explicit states (in their declared 
    array order), then any states injected by state-trigger expansion 
    (REQ-114/REQ-115).
  
  - [REQ-036] A default precondition state shall only be used when the
    transition does not already mention a state from the same owning
    state machine. This lets a transition's own explicit states override
    (and reposition) what a default precondition or the implied initial
    state would otherwise have supplied: restating that machine's state
    explicitly, anywhere in the transition's own `states` array, both
    substitutes for the default/implied value and places it among the
    transition's own explicit states (REQ-035's second group) instead of
    at the front with the other defaults — letting a single transition
    force a custom precondition order for itself.
  
  - [REQ-150] The owning state machine of a state name shall be resolved with
    the parse step's ownership lookup (REQ-409, `smtt.parse.validate.md`).
  
  - [REQ-038] The default precondition states and their names shall be taken
    from AST path `[i].defaultPreconditions[*].state`.
  
  - [REQ-156] When a default precondition argument carries a modifier, the
    modifier shall reference the base value of the same attribute as encountered
    in the specific transition it is injected into. If no base reference exists
    in the transition, the generator shall raise an error.
  - [REQ-039] The transition specific states and their names shall be taken from
    AST path `[i].transitions[j].states[*].name`.
  - [REQ-132] When no state from the current machine appears in the effective
    precondition list (after default precondition injection), the machine's
    initial state shall be implied as transition precondition, regardless of
    whether external preconditions exist.
  - [REQ-133] The initial state shall be taken from AST path
    `[i].initialState`.
  - [REQ-134] When the initial state is not explicitly defined, the state
    machine's first state shall be used as initial state.
- `When`: transition trigger
  - [REQ-040] The `When` step shall be emitted as `When $trigger-name
    [$arguments]`.
  - [REQ-041] The trigger name shall be taken from AST path
    `[i].transitions[j].trigger.name`.
- `Then`: transition result state
  - [REQ-042] The `Then` step shall be emitted as `Then expect $result-name
    [$arguments]`.
  - [REQ-043] The result name shall be taken from AST path
    `[i].transitions[j].result.name`.

- [REQ-044] The terms `initially` and `expect` shall succeed the `Given`
  respectively `Then` steps in order to make an additional distinction between
  step types (`Given`, `When`, `Then`), because a framework mapping the Gherkin
  steps to code might not support such a distinction (like Playwright's `bddgen`
  tool).

```gherkin
Scenario: [REQ-003] Item available → item in cart; when item added to cart; given user session present
  Given initially user session present
  And initially item available
  When item added to cart
  Then expect item in cart
  # Notes: Cart hold is time-limited and will expire automatically
```

- [REQ-045] `# Notes:` shall be appended after the final `Then` step
  (including any intermediate expansion steps) when notes are defined.

- [REQ-046] The notes shall be taken from AST path `[i].transitions[j].notes`.

## State Arguments

- [REQ-047] When any state, the trigger, or an applicable default precondition
  carries argument(s), the scenario shall be emitted as a `Scenario Outline`
  with an examples table (described further down), instead of a `Scenario`.

- [REQ-048] The generator shall add the arguments information after the state
  name.

- [REQ-049] The arguments shall be taken from AST paths:
  - `[i].transitions[j].states[*].arguments[*]`
  - `[i].transitions[j].trigger.arguments[*]`
  - `[i].transitions[j].result.arguments[*]`

- [REQ-050] Each argument shall be appended comma separated to the state name in
  order.

Components:

```gherkin
$qualifier "<$attribute-name>" [$suffix]
```
or
```gherkin
[$pre-qualifier] $modifier [$post-qualifier] "<$attribute-name>" [$suffix]
```

Examples:
- `as "<email address>"`
  - `$qualifier`: `as`
- `with "<email address>" prefilled`
  - `$qualifier`: `with`
  - `$suffix`: `prefilled`.
- `under next "<email address>"`
  - `$modifier`: `next`
  - `$pre-qualifier`: `under`
- `next under "<email address>"`
  - `$modifier`: `next`
  - `$post-qualifier`: `under`.


- [REQ-051] `$pre-qualifier` shall be a qualifying word/phrase before the
  modifier.
  - [REQ-052] The `$pre-qualifier` shall be taken from AST path
    `[i].transitions[j].states[*].arguments[*].preQualifier`.

- [REQ-053] `$modifier` shall be the qualifying word/phrase before the
  attribute name.
  - [REQ-054] The `$modifier` shall be taken from AST path
    `[i].transitions[j].states[*].arguments[*].modifier`.

- [REQ-055] `$post-qualifier` shall be the qualifying word/phrase after the
  modifier.
  - [REQ-056] The `$post-qualifier` shall be taken from AST path
    `[i].transitions[j].states[*].arguments[*].postQualifier`.

- [REQ-057] `$qualifier` shall be a single qualifier before the attribute name,
  in case no modifier is given.
  - [REQ-058] The `$qualifier` shall be taken from AST path
    `[i].transitions[j].states[*].arguments[*].qualifier`.

- [REQ-059] `$suffix` shall be the word/phrase after the attribute name.
  - [REQ-060] The `$suffix` shall be taken from AST path
    `[i].transitions[j].states[*].arguments[*].suffix`.

- [REQ-061] `$attribute-name` shall be the name of a state's data attribute,
  present as a column in the `Examples:` table below the step definitions.
  - [REQ-062] The `$attribute-name` shall be taken from AST path
    `[i].transitions[j].states[*].arguments[*].name`.

- [REQ-442] A transition result's argument shall not be rendered when the
  result state's implied conditions pin its attribute to one concrete value —
  absence via `undefined`, or a literal via `=` (REQ-433 in
  `smtt.parse.validate.md`) — and the argument assigns exactly that value. The
  `resulting $attribute-name` column then goes unreferenced and is dropped by
  REQ-436; a transition whose only argument is suppressed this way renders as a
  plain `Scenario` (REQ-047).

  The pin is the same one REQ-434 in `smtt.parse.complete.md` reads to
  synthesise these arguments, so rendering hides exactly what completion adds.
  Tying the two to one definition keeps them from drifting apart: an operator
  that starts pinning a value gains both behaviours at once, and one that stops
  loses both.

  Rationale: an implied condition describes every occurrence of its state
  (REQ-433), so such an argument's column holds the same cell in every row by
  construction. It can never tell two rows apart, and what it would assert is
  already carried by the result state's own name — `Then expect cart empty`
  states exactly what a `"<resulting painting count>"` of `0` would, and
  `Then expect painting available` exactly what an empty `"<resulting painting
  assignee name>"` would. Rendering it yields a step parameter whose value no
  fixture has to be told.

  Remarks:
  - This is a rendering rule only. The argument remains in the completed AST,
    so a state trigger resolving against this result still binds to it
    (REQ-438 in `smtt.parse.complete.md`) and reads the pinned value, rather
    than carrying over the value the attribute held before the transition.
  - No row is lost. Row filters are collected from the transition and its
    expansion chain, never from the rendered columns, so suppression removes
    no row; and a suppressed column is constant, so it collapses none either
    under REQ-160/REQ-440.
  - Suppression does not depend on who wrote the argument: an author spelling
    out the redundant assignment, qualifier included, gets the same step as one
    leaving it to REQ-434. Otherwise the two spellings of one outcome would
    render as two different steps.
  - An argument assigning anything else is always rendered: a different
    literal, which contradicts the target and REQ-433 reports; or an attribute
    reference, whose value is not statically the pinned one.
  - `defined` pins no single value and so suppresses nothing, and neither does
    a modifier argument, which renders a derived column of its own instead of
    the `resulting` one. A sameness (`as`) pin binds rather than assigns, so it
    is not one of REQ-434's pins and suppresses nothing here either.


## Scenario Examples

- [REQ-063] When the scenario carries arguments, an examples table shall be
  appended.

```gherkin
  Scenario Outline: ...
    Given ...
    When ...
    Then ...
    Examples:
    | email address |
    | info@domain.com |
```

The table columns shall be built from argument usage in the transition
definition as follows:

- [REQ-064] The table shall include every _base_ argument name referenced in
  first-encounter order — scanning default preconditions first (in their array
  order), then explicit transition states (in their array order), then the
  trigger, then the result.

- [REQ-170] For a state-trigger transition, REQ-064's scan extends into that
  expansion path's own chain of sources (REQ-114/REQ-115): after the
  top-level transition's own groups, each source in the path's chain
  contributes its own default preconditions, states, trigger, and result, in
  that same order, innermost source first.

- [REQ-171] Each expansion path (REQ-113) computes its own columns and
  `Examples:` table from its own chain only (REQ-170) — never from a sibling
  path's chain. An argument declared only on one path's source is therefore a
  column on that path's scenario alone, not on sibling scenarios of the same
  transition.

- [REQ-065] The table shall add _derived_ columns required by modifiers.

- [REQ-066] The table shall add _derived_ columns required by result values.

- [REQ-151] Each base attribute name shall appear as a column exactly once, at
  its first-encountered position.

- [REQ-152] Derived columns (`resulting X`, `incremented X`, `different X`,
  etc.) shall be appended after all base columns, in their encounter order.

- [REQ-169] A base attribute name shall not receive a column when its only
  occurrence in the transition is a result argument carrying a result value —
  such an argument's step placeholder always references the derived
  `resulting $attribute-name` column instead (REQ-101), so the base column
  would otherwise go unused in every rendered step. When the same attribute is
  also referenced elsewhere in the transition without a result value (e.g.
  a precondition, trigger, or plain result reference), its base column is kept,
  since that occurrence does render `"<$attribute-name>"`.
  - Dropping the base column may leave rows that are identical in every
    remaining column; these are collapsed to one by the existing row
    de-duplication (REQ-160).

- [REQ-436] A column shall be dropped from the table when its
  `<$column-name>` placeholder is not rendered in any of the scenario's steps,
  e.g. an argument of a default precondition that the transition overrides
  with an explicit state of the same machine. When no column remains, a plain
  `Scenario` is rendered without an `Examples:` block (REQ-047).
  - Rows that become identical after dropping columns are collapsed by the
    row de-duplication (REQ-160).

Derived attribute columns are described in next sections.

- [REQ-067] Row construction shall use `$example-data-values` as starting
  point.

- [REQ-160] Rendered examples table rows shall be unique: any row whose
  displayed values repeat an earlier row in the final `Examples:` block shall be
  removed, keeping the first occurrence. Duplicate rows shall be eliminated after
  filtering and before the final table is emitted.

- [REQ-440] A rendered examples table row shall be pruned when renaming its
  interchangeable values turns it into an earlier row, keeping the first row.

  Rationale: a state machine tells values apart in three ways only. It can
  name a literal in a condition, implied condition or result. It can compare a
  value with another value of the same row (`as`, reference conditions and
  results, bindings, `not`/`different` columns). And it can relate values by
  order, pool position or arithmetic. Renaming values the model tells apart in
  none of these ways is a symmetry of the model: the renamed row runs the same
  scenario with other data, so it adds no coverage.

  Remarks:
  - A cell is *significant*, and so kept as it is, when:
    - it is empty (undefined);
    - it belongs to a literal result column;
    - its value is a literal named anywhere in the model;
    - its attribute is *concrete*, meaning an ordering or range operator
      (`<`, `>`, `<=`, `>=`, `in range`, `not in range`) or an
      `incremented`/`decremented`/`first`/`last`/`next`/`previous` modifier
      applies to it anywhere in the model.
  - Every other cell is replaced by the position of its value's first
    occurrence among the row's interchangeable values. All columns share one
    numbering, so equalities between cells, such as a result copying a trigger
    value, survive the renaming.
  - Two rows are equivalent when these canonical forms match. Pruning runs
    after the de-duplication of REQ-160 and always applies.
  - A value that only fixtures or helpers treat specially is invisible to the
    model. To keep it distinguished, name it in a condition or implied
    condition.

  Example: with no prior identity, rows `user1/User A`, `user1/User B`,
  `user2/User A` and `user2/User B`, each copied into the results, all read
  `$0/$1` and collapse into the first row. Once a precondition names `user1`,
  the `user1` and `user2` rows are no longer equivalent: one matches the named
  value and the other does not.

- [REQ-068] The `$example-data-values` shall be taken from AST path
  `[i].dataValueCombinations`. This table may contain both author-defined rows and
  rows synthesised by the `complete` step (REQ-420/REQ-421); both kinds are
  treated identically by the generator.

- [REQ-157] The generator shall raise an error when arguments are referenced
  in a transition (directly or indirectly) but the effective `$example-data-values`
  table across all contributing machines is empty after row merging — i.e. no
  attribute columns exist to drive the `Examples:` block.

- [REQ-069] State/trigger conditions shall be applied as row filters.

- [REQ-070] Modifiers shall be added as additional columns per
  surviving row.

Example — given:

```markdown
  ### Value combinations

  | `email address`     | `associated user name` |
  |---------------------|------------------------|
  | "info@domain.com"   | "John Doe"             |
  | "other@example.com" | "Jane Doe"             |
```

Scenario example table:
```gherkin
  Scenario Outline: ...
    ...
    Examples:
    | email address     | different email address |
    | info@domain.com   | other@example.com       |
    | other@example.com | info@domain.com         |
```

### Empty Values in Data Tables

- [REQ-073] An empty string (`""`) in `$example-data-values`
  shall represent an undefined/absent value for that attribute.

- [REQ-074] When used in modifier lookups or condition filtering, empty strings
  shall be treated as undefined.

- [REQ-075] Empty strings shall not match any comparison operator except
  `undefined`.

### Modifiers

A modifier expresses the relationship between the current argument's value and
the value of the same attribute established elsewhere in the same transition.
It is invalid when there is no reference to derive from.

When multiple precondition states (from different machines) both reference the
same attribute, a modifier on either precondition is valid as long as the other
precondition provides the base reference. Example: `Machine X state` with `A`,
`Machine Y state` with incremented `A` — Machine Y's precondition value of A
equals Machine X's value + 1, regardless of which precondition appears first in
the scenario.

- [REQ-076] Modifiers shall extend the data combination tables (`Examples`) by
  adding columns based on the data attribute values.

- [REQ-136] A modifier on an argument shall be valid only when a base reference
  to the same attribute exists somewhere in the transition. The
  generator shall raise an error when no base reference exists.

- [REQ-137] When an argument carries a modifier, the step placeholder shall
  reference the derived column name (e.g. `<incremented count>`,
  `<different email address>`) rather than the base column name.

Complete example — transition: `State A` with `count`, trigger `event X`,
result `State B` with incremented `count`:

```gherkin
Scenario Outline: [REQ-001] state a → state b; when event x
  Given initially state a "<count>"
  When event x
  Then expect state b "<incremented count>"
  Examples:
    | count | incremented count |
    | 0     | 1                 |
    | 1     | 2                 |
```

#### Modifier summary

| Modifier                  | Column name         | Value derivation                       | Constraints                   |
|---------------------------|---------------------|----------------------------------------|-------------------------------|
| `incremented`             | `incremented $attr` | base value + 1                         | Numeric only                  |
| `decremented`             | `decremented $attr` | base value − 1                         | Numeric only                  |
| `next`                    | `next $attr`        | next row circular                      | Uses original table           |
| `previous`                | `previous $attr`    | previous row circular                  | Uses original table           |
| `first`                   | `first $attr`       | first table value                      | —                             |
| `last`                    | `last $attr`        | last table value                       | —                             |
| `not`/`other`/`different` | `different $attr`   | first different value in example table | ≥2 distinct values in example |

Detailed modifier specifications follow.

- `incremented` / `decremented`

  - [REQ-077] The `incremented` / `decremented` modifiers shall take the
    incremented / decremented value from the examples table.
  - [REQ-078] The `incremented` / `decremented` modifier column shall be named
    `$modifier $attribute-name`.

  - Data example table in state machine spec:
    ```markdown
      | a |
      |---|
      | 0 |
      | 1 |
      | 2 |
    ```
  - Feature scenario example table:
    ```gherkin
      | a | incremented a | 
      | 0 | 1             |
      | 1 | 2             |
      | 2 | 3             |
    ```
  - [REQ-079] The `incremented` / `decremented` modifiers shall only work on
    numerical values.
  - [REQ-080] The parser component shall verify that these modifiers are applied
    to numerical values.

- `previous` / `next`

  - [REQ-081] The `previous` / `next` modifiers shall take the previous / next
    value from the examples table, in a circular way (previous of first value is
    last value, next of last value is first value).
  - [REQ-082] The `previous` / `next` modifier column shall be named
    `$modifier $attribute-name`.
  - [REQ-158] The `previous` / `next` modifiers shall derive position from the
    *original* full example values table, not from any condition-filtered
    subset. The `incremented` / `decremented` modifiers operate on the row's
    own value (±1) independently and are unaffected by row filtering.

  - Data example table in state machine spec:
    ```markdown
      | a  |
      |----|
      | a0 |
      | a1 |
      | a2 |
    ```
  - Feature scenario example table:
    ```gherkin
      | a  | next a | 
      | a0 | a1     |
      | a1 | a2     |
      | a2 | a0     |
    ```

- `first` / `last`

  - [REQ-138] The `first` modifier shall always take the first value from the
    example values table, regardless of the current row position.
  - [REQ-139] The `last` modifier shall always take the last value from the
    example values table, regardless of the current row position.
  - [REQ-140] The `first` / `last` modifier column shall be named
    `$modifier $attribute-name`.

  - Data example table in state machine spec:
    ```markdown
      | a  |
      |----|
      | a0 |
      | a1 |
      | a2 |
    ```
  - Feature scenario example table:
    ```gherkin
      | a  | first a |
      | a0 | a0      |
      | a1 | a0      |
      | a2 | a0      |
    ```

#### Modifier with condition

- [REQ-142] A modifier and a condition may co-exist on the same argument.

- [REQ-143] When both are present, the order of operations shall be:
  derive the modifier column value first, then filter rows where the derived
  value satisfies the condition.

- [REQ-144] The condition applies to the derived (modified) value, not the
  base value.

Example: precondition `State X` with `count` = 5, result `State Y` with
incremented `count` > 5 — the derived column `incremented count` = 6, and the
condition `> 5` is satisfied, so the row survives.

### Conditions

- [REQ-086] Argument conditions shall filter/extend the data combination tables
  (`Examples`) by removing rows/adding columns.

Examples:
- `` `count >= 1` ``
- `` `item in [A, B]` ``

- [REQ-087] Conditions on precondition state or trigger arguments (both
  `event`- and `state`-type triggers) shall filter the examples rows to those
  that match. For `state`-type triggers this is orthogonal to expansion
  candidate matching (REQ-118): expansion determines which source transitions
  apply; the condition then filters the data rows.

- [REQ-161] For expanded state triggers, the effective data table shall be the
  owning state machine's own example data values table, extended with columns
  for any attribute it does not itself declare, contributed (cross-joined) by
  other machines in the expansion chain.

  Example: machine `m2` owns the transition being rendered and declares only
  `a2` (values `3`, `4`); its state trigger expands into machine `m1`, which
  declares `a1` (values `1`, `2`). `m2` does not declare `a1` itself, so the
  effective table starts from `m2`'s own rows and is extended with the new
  `a1` column, cross-joined against `m1`'s values:

  ```gherkin
  | a1 | a2 |
  | 1  | 3  |
  | 2  | 3  |
  | 1  | 4  |
  | 2  | 4  |
  ```

- [REQ-168] The cross-join in REQ-161 only ever adds columns the owning
  machine does not already declare — it never overrides one. When an
  attribute name is declared by both the owning machine and another
  contributing machine, the owning machine's own example values are
  authoritative for that attribute; a state machine must be sufficiently
  specified stand-alone, so the two machines' values are never required to
  match, and the other machine's values for that name are never consulted.

  Example: State machine `m1` owns the transition and declares attribute `a1`
  with its own value `v1`. Its transition also reaches machine `m2` (via the
  expansion chain), which independently declares the *same* attribute `a1`
  with a *different* value, `v2`, plus attribute `a2` (value `v3`) that `m1`
  doesn't have:

  ```gherkin
  | a1 | a2 |
  | v1 | v3 |
  ```

  `a1` stays `v1` — `m1`'s own value (per REQ-168) — and `a2` is added as a
  new column (per REQ-161); `m2`'s own `a1` value (`v2`) is discarded, not
  merged or checked for a match.

- [REQ-162] Conditions from all transitions in an expansion chain shall be
  merged as a conjunction: a row survives only if it satisfies ALL conditions
  from the top-level transition AND all source transitions in the chain.

- [REQ-088] Result values shall extend the columns.

- [REQ-089] The `resulting $attribute-name` column cell value shall be taken
  directly from `result.value` in the AST. A result argument's value is always
  a plain equality assignment (REQ-415, `smtt.parse.validate.md`), so there is
  no operator to interpret here.

E.g.
- Result argument `` `count` set to 2 `` → `resulting count` column with value `2`.
- Result argument `` `status` set to "active" `` → `resulting status` column with
  value `active`.

Supported operators:

- [REQ-090] The generator shall support numeric comparison operators on
  numerical attributes: `=`, `<>`, `>`, `<`, `>=`, `<=`.

- [REQ-091] The generator shall support set membership operators: `in`,
  `not in`, e.g. `` `a in (1, 4)` ``.

- [REQ-092] The generator shall support range membership operators: `in range`,
  `not in range`, e.g. `` `a in [1, 4]` ``.
  - [REQ-093] Boundary notation shall follow interval convention: `[` and `]`
    denote inclusive bounds, `(` and `)` denote exclusive bounds.
  - [REQ-094] Mixed forms shall be allowed, e.g. `` `a in [1, 4)` `` means `1 <=
    a < 4`. The bounds and their brackets reach the generator as one value
    string (REQ-145, `smtt.parse.validate.md`); the fully exclusive
    `` `a in (1, 4)` `` is the set form, not a range.

- [REQ-095] The generator shall support the text spellings of the equality
  filters: `is` / `are` for `=`, and `is not` / `are not` for `<>`. The `as`
  operator is not one of them — it states sameness and binds (REQ-432).

- [REQ-096] The generator shall support the unary absence check `undefined` (no
  value; checks that the attribute is absent/unset).

- [REQ-097] The operator shall be taken from AST path
  `...arguments[*].condition.operator`.

- [REQ-098] The condition value shall be taken from AST path
  `...arguments[*].condition.value`.

- [REQ-427] A condition value marked as an attribute reference
  (`...condition.valueIsReference`, REQ-424 in `smtt.parse.validate.md`) shall
  not be compared as a literal: for each candidate row, the condition shall be
  evaluated against the value that row itself holds for the referenced
  attribute. The same condition can therefore hold for one row and fail for
  the next. A row that holds no value for the referenced attribute — it has no
  column for it, or the cell is empty — shall not survive the filter: an
  absent value pins nothing to compare against.

  The referenced attribute contributes no column of its own: like any other
  attribute, it is rendered only when the transition also references it as an
  argument.

- [REQ-432] The `as` operator shall state sameness rather than filter: the
  attribute *takes* the value named — a literal, or, for an attribute reference
  (REQ-427), the value the referenced attribute holds in the same row. Every
  such binding shall be applied to all rows before any filter is evaluated, so
  a filter on a bound attribute tests the value the binding gave it rather than
  whatever the declared table held.

  Sameness is satisfied by construction, never searched for among the declared
  rows. Two state machines can therefore relate their attributes without either
  having to declare a literal value that coincides with the other's — which no
  author can arrange, since which machine's values survive the merge (REQ-168)
  is decided by an expansion the author does not write.

  A row whose reference cannot be resolved — the referenced attribute has no
  column in the effective table, or holds no value in that row — shall not
  survive: there is no value for the bound attribute to take, so the sameness
  cannot hold for that row.

  An `as` carrying a modifier (REQ-143/REQ-144) remains a filter: it constrains
  a *derived* value, which is not something a row's own column can be assigned.

  Chained bindings (`` `a` as `b` ``, `` `b` as `c` ``) shall resolve
  transitively, so `a` ends up holding `c`'s value.

- Data example table in state machine spec:
  ```markdown
    | offer | list price |
    |-------|------------|
    | 10    | 10         |
    | 5     | 20         |
  ```
- With `` `offer` as `list price` `` on the precondition state argument, and
  `list price` referenced as a plain argument too, then examples table — the
  second row's `offer` differs from its own `list price`, so it drops out:
  ```gherkin
    | offer | list price |
    | 10    | 10         |
  ```

- [REQ-428] A reference-valued condition on a state trigger's argument shall
  impose no constraint while matching expansion candidates (REQ-118): that
  matching is structural and has no example row to resolve the reference
  against. The condition applies per row afterwards, as REQ-427 describes.

#### State/trigger conditions

- [REQ-099] Arguments shall result in filtering out certain examples in the
  scenario.

- [REQ-100] If all rows are filtered out, the generator shall raise an error —
  an empty examples table is not valid.

- Data example table in state machine spec:
  ```markdown
    | a |
    |---|
    | 0 |
    | 1 |
    | 2 |
  ```
- With `` `a >= 1` `` then examples table:
  ```gherkin
    | a  | 
    | 1  |
    | 2  |
  ```

#### Implied state conditions

- [REQ-148] The implied conditions declared on a state definition shall be used
  by the feature generator: when that state is a precondition (`Given`) state of
  a transition, its implied conditions shall filter the examples table rows in
  the same way as explicit precondition-argument conditions (REQ-099/REQ-100).

- [REQ-165] The implied conditions of a precondition state shall be taken from
  AST path `[i].states[k].impliedConditions[*]`, where `k` is the index of the
  precondition state matched by name against `[i].states[*].name`. This applies
  to every effective `Given` state of the transition — explicit transition
  states, injected default preconditions, and the implied initial state.

- [REQ-166] Each implied condition's `$attribute-name` shall be taken from AST
  path `[i].states[k].impliedConditions[*].attribute` and matched against the
  examples table column of the same name. An implied condition on an attribute
  that is not present in the effective examples table shall impose no filter.

- [REQ-167] Each implied condition's operator and value shall be taken from AST
  path `[i].states[k].impliedConditions[*].condition` and evaluated with the
  same operators as argument conditions (REQ-090 through REQ-096). Implied
  conditions only filter rows; they neither add columns nor turn a plain
  `Scenario` into a `Scenario Outline`.

#### Result values

- [REQ-101] Result values on result arguments shall potentially add
  additional columns in the examples table, under the column name
  `resulting $attribute-name`, and result argument step placeholders shall
  reference `"<resulting $attribute-name>"`.
- Data example table in state machine spec:
  ```markdown
    | a |
    |---|
    | 0 |
    | 1 |
    | 2 |
  ```
- With `` `a = 1` `` on a precondition state argument and `` `a` set to 2 ``
  on the result argument, <br/> (``state x with `a = 1` ``, and trigger `...`,
  results in ``state x with `a` set to 2 ``)<br/> then scenario steps and
  examples table:
  ```gherkin
    Scenario Outline: [REQ-001] x "<a>" â†’ x "<resulting a>"; when e
      Given initially x "<a>"
      When e
      Then expect x "<resulting a>"
      Examples:
        | a  | resulting a |
        | 1  | 2           |
  ```

- When `a` is *not* otherwise referenced in the transition — no precondition,
  trigger, or plain result argument for it, only the result value — its
  base column is dropped (REQ-169) and rows that then differ only by the
  discarded `a` value collapse into one:
  ```markdown
    | a |
    |---|
    | 0 |
    | 1 |
    | 2 |
  ```
  With just `` `a` set to 2 `` on the result argument (no precondition on
  `a`), <br/> (state `x`, trigger `e`, results in `` x with `a` set to 2 ``)
  <br/> then scenario steps and examples table:
  ```gherkin
    Scenario Outline: [REQ-001] x â†’ x "<resulting a>"; when e
      Given initially x
      When e
      Then expect x "<resulting a>"
      Examples:
        | resulting a |
        | 2           |
  ```

- [REQ-423] When a result's value is an attribute reference
  (`result.valueIsReference`, REQ-424 in `smtt.parse.validate.md`), the
  `resulting $attribute-name` column's cell value shall be taken from that
  *row's own value* for the referenced attribute, instead of the fixed literal
  REQ-089 otherwise takes it from.

- [REQ-437] A bound result reference (REQ-438 in `smtt.parse.complete.md`)
  shall take its cell value from the `resulting $attribute-name` column it is
  bound to, instead of from REQ-423's row value of the referenced attribute.

  Rationale: along an expansion chain one attribute name has a value before
  the event and one after each link that sets it. The base column holds the
  former (filtered for the `Given` states, REQ-148); a trigger argument means
  the latter, the value its source produced. An unbound reference, one to an
  attribute the transition's trigger did not receive from its source's result,
  keeps REQ-423's row value. Resolution recurses when the bound column is
  itself a bound reference, and ends at a base column or a literal.

  Example:
  ```markdown
  m1: state `s1` with `b`, trigger `e`, result `s2` with `a` set to `b`
  m2: state `s3`, trigger (state) `s2` with `a`, result `s4` with `c` set to `a`
  ```
  `m1`'s result sets `a`, so `m2`'s trigger argument `a` is bound to
  `resulting a`, and `c` takes `b`'s value through it. Were `m2`'s trigger
  `s2` without `a`, `c` would take `a`'s own value from before the event.
  ```gherkin
    Scenario Outline: [REQ-002] s3 → s4 "<resulting c>"; when e
      Given initially s3
      When e with "<b>"
      Then expect s2 with "<resulting a>"
      Then expect s4 with "<resulting c>"
      Examples:
        | b | resulting a | resulting c |
        | 5 | 5           | 5           |
  ```

- Data example table in state machine spec:
  ```markdown
    | p  |
    |----|
    | 10 |
    | 20 |
  ```
- With `` `x` with `p` `` as the precondition state and `` `q` set to `p` ``
  on the result argument, <br/> (trigger `e`, results in
  `` x with `q` set to `p` ``)<br/> then scenario steps and examples table —
  each row's `resulting q` tracks that same row's own `p`, not one shared
  literal:
  ```gherkin
    Scenario Outline: [REQ-001] x "<p>" â†’ x "<resulting q>"; when e
      Given initially x "<p>"
      When e
      Then expect x "<resulting q>"
      Examples:
        | p  | resulting q |
        | 10 | 10          |
        | 20 | 20          |
  ```

---

## State Trigger Expansion

- [REQ-102] Triggers shall be of either `event` type or `state` type.  
  A state trigger represents another state machine entering that state,
  which then cascades into a transition of the current state machine.

- [REQ-103] The trigger type shall be taken from AST path
  `[i].transitions[j].trigger.type`.

- [REQ-104] For state triggers, the trigger shall not directly map 
  to a `When` step. Instead, the generator shall look up the transition(s) 
  in the owning state machine that lead to the named trigger state.

- [REQ-106] The owning state machine shall be the machine `[i]` whose defined
  states (AST path `[i].states[*].name`) contain the trigger state name.

- [REQ-154] The generator shall raise an error if a state name lookup is
  ambiguous (i.e. the same state name appears in multiple machines, REQ-409).
  The parser's validate step enforces uniqueness, so this serves as an
  internal assertion.

For each source found:

- [REQ-107] When the source has an event trigger, that trigger name shall become
  the `When` step.

- [REQ-108] When the source has a state trigger, the expansion shall recurse
  further into that source until an event trigger is reached.

- [REQ-155] The generator shall detect circular expansion chains (e.g. machine
  A triggers on state of machine B, machine B triggers on state of machine A)
  and raise an error.

- [REQ-109] For state triggers, an additional `Then expect $trigger-result-state-name`
  step shall be emitted between the `When` step and the final `Then
  expect $result-state-name` step, representing the direct result of the
  resolved event.

- [REQ-110] This additional step shall reflect the causal chain: the event
  produced an intermediate state, which triggered the transition, which produced
  the final result.

- [REQ-146] When expansion recurses (state trigger → state trigger → event
  trigger), intermediate `Then` steps shall be emitted in chronological
  causal order: innermost expansion result first, with the top-level result
  last. Each step renders the result of its own transition, whose references
  resolve through the bindings of that transition's trigger (REQ-437).

Example: trigger state `user authenticated as "<email address>"`, expanded via
event `signed in with "<email address>"` whose result is `user authenticated as
"<email address>"`:
```gherkin
When signed in with "<email address>"
Then expect user authenticated as "<email address>"
Then expect default user identity available as "<email address>"
```

Example with multiple machines — consider two state machines:
- **User Session** machine has a transition: from `session active`, when event
  `sign in requested`, result `user authenticated as "<email address>"`.
- **Identity** machine has a transition: from `identity absent`, when state
  trigger `user authenticated as "<email address>"`, result `default user
  identity available as "<email address>"`.

When generating the Identity machine's transition, the state trigger
`user authenticated` is expanded by finding the User Session transition that
produces it. The resulting scenario:

```gherkin
When sign in requested with "<email address>"
Then expect user authenticated as "<email address>"
Then expect default user identity available as "<email address>"
```

Here, `sign in requested` is the resolved event (from User Session), `user
authenticated` is the intermediate result (the trigger state, from User
Session's result), and `default user identity available` is the top-level
result (Identity machine's result).

- [REQ-111] Both trigger types shall only determine the `When` step.

- [REQ-112] The final `Then` step shall always come from the transition result
  of the top level transition.

- [REQ-113] When expansion produces multiple paths (multiple source
  transitions), each path shall generate its own scenario, differentiated by a
  `.1`, `.2`, … suffix on the scenario (transition) ID.

- [REQ-029] For state trigger based transitions with multiple expansion paths, a
  path suffix shall be appended to the id.

- [REQ-030] The `→ $result-state-name` part shall stay the same across paths.

  ```
  [$id.1] $original-state-name → $result-state-name; when $expansion-1; given $context-states
  [$id.2] $original-state-name → $result-state-name; when $expansion-2; given $context-states
  ```

- [REQ-031] For expanded paths, `$context-states` in the label shall be the
  merged set of all `Given` precondition states, excluding the own state, listed
  in effective step order (the top-level transition's own default
  preconditions first, in their declared array order, then the top-level
  transition's own explicit states, then the states injected by the
  expansion source(s)).

- [REQ-114] The `Given` precondition steps for an expanded scenario shall
  include states from both the source (expanded) transition and the top-level
  transition.

- [REQ-115] The `Given` precondition steps for an expanded scenario shall be
  merged in effective order: the top-level transition's own default
  preconditions first (in their declared array order), then the top-level
  transition's own explicit states (in their declared array order), then the
  states injected by the expansion source(s). A source's own states are
  contributed in the same recursive order (REQ-135): its own default
  preconditions first, then its own explicit states.

- [REQ-116] Duplicate state references (same name and same arguments) shall be
  de-duplicated, keeping the first occurrence — so a later-listed state (e.g.
  one injected by expansion) that repeats a name already present among the
  earlier groups (default preconditions, then the transition's own explicit
  states, per REQ-035/REQ-115) is dropped, leaving the earlier reference in
  place.
  - Note it is invalid for references to share the same state name but carry
    different arguments.

- [REQ-118] A source transition shall only be considered a matching expansion
  candidate if its result state arguments match the trigger state arguments of
  the referring transition (the transition being expanded). I.e., the same
  attribute names shall be referenced, with the same modifier on both sides —
  a bare trigger argument only matches a bare result argument, and a modified
  trigger argument only matches a result argument carrying the same modifier —
  AND the source's result shall produce a value that satisfies the referring
  transition's trigger condition. This shall apply recursively when expansion
  chains through multiple state triggers.

  A name match with differing modifiers is not a match: the two occurrences
  denote different roles for the same attribute (e.g. a plain value vs. the
  next one in sequence), so the source is disqualified as a candidate for that
  attribute.

  **Matching example**: Trigger condition is `user authenticated as "<email>"`.
  Source transition result is `user authenticated as "<email>"` with condition
  `email = "info@example.com"`. The source matches because it references the
  same attribute (`email`), carries the same (absent) modifier, and produces a
  concrete value.

  **Non-matching example**: Trigger condition is `user authenticated as "<email>"`.
  Source transition result is `user authenticated` (no arguments). The source
  does NOT match because the trigger requires an `email` argument that the
  source doesn't provide.

  **Non-matching modifier example**: Trigger is `painting reserved under
  "<bid>"` (no modifier). Source transition result is `painting reserved for
  "<next bid>"` (`next` modifier). Both reference the same attribute (`bid`),
  but the source carries a modifier the trigger doesn't — the source is not a
  matching candidate for this trigger, even though a looser, name-only
  comparison would accept it.

- [REQ-164] A state trigger is unresolvable when no transition result 
  matches, or when candidate source transitions exist by result state name 
  but none satisfies REQ-118's argument-matching rule. Then the generator shall 
  raise an error.

- [REQ-135] The implied initial state rule (REQ-132/REQ-134) shall also apply
  when resolving each source transition found during expansion: a source
  transition's own owning state machine (not the top-level transition's
  machine) determines its default preconditions and effective initial state
  for this purpose.

---

## Layout

- [REQ-119] All generated feature files shall follow standard Gherkin
  indentation conventions:

- [REQ-120] The `Feature:` header shall be indented 0 spaces.

- [REQ-121] The feature description (`$overview`) shall be indented 2 spaces.

- [REQ-122] The `Scenario:` / `Scenario Outline:` shall be indented 2 spaces.

- [REQ-123] The step keywords (`Given`, `And`, `When`, `Then`) shall be indented
  4 spaces.

- [REQ-124] The `# Notes:` comment shall be indented 4 spaces.

- [REQ-125] The `Examples:` keyword shall be indented 4 spaces.

- [REQ-126] The examples table rows shall be indented 6 spaces.

Blank lines:

- [REQ-127] One blank line shall be emitted after the `Feature:` block (header +
  optional description) before the first `Scenario:`.

- [REQ-128] One blank line shall be emitted between consecutive `Scenario` /
  `Scenario Outline` blocks.

- [REQ-129] No blank line shall be emitted between the last `Then` step and the
  `# Notes:` comment.

- [REQ-130] No blank line shall be emitted between `Examples:` and its table.

---

## Non-generation AST sections

- [REQ-147] The impossible and irrelevant sections in the AST shall be
  treated as informational only and shall be ignored by the feature generator.
  They shall not produce scenarios or affect scenario generation.

- [REQ-149] Metadata fields (source file path, source line number) in the AST
  shall not be used in feature generation.

