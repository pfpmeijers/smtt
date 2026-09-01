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
    order (injected default preconditions first, explicit transition states
    after).
  - [REQ-036] A default precondition state shall only be used when the
    transition does not already mention a state from the same owning
    state machine.
  - [REQ-150] The owning state machine of a state name shall be determined by
    finding the machine whose `states` array contains an entry with a matching
    `name`. State names are globally unique across all machines in the AST file.
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
- `under different "<email address>"`
  - `$modifier`: `different`
  - `$pre-qualifier`: `under`
- `not under "<email address>"`
  - `$modifier`: `not`
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
- [REQ-065] The table shall add _derived_ columns required by modifiers.
- [REQ-066] The table shall add _derived_ columns required by conditions.
- [REQ-151] Each base attribute name shall appear as a column exactly once, at
  its first-encountered position.
- [REQ-152] Derived columns (`resulting X`, `incremented X`, `different X`,
  etc.) shall be appended after all base columns, in their encounter order.

Derived attribute columns are described in next sections.

- [REQ-067] Row construction shall use `$example-data-values` as starting
  point.
- [REQ-160] Rendered examples table rows shall be unique: any row whose
  displayed values repeat an earlier row in the final `Examples:` block shall be
  removed, keeping the first occurrence. Duplicate rows shall be eliminated after
  filtering and before the final table is emitted.
- [REQ-068] The `$example-data-values` shall be taken from AST path
  `[i].dataExampleValues`. This table may contain both author-defined rows and
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
  Example values:

  | `email address`     | `associated user name` |
  |---------------------|------------------------|
  | `info@domain.com`   | `John Doe`             |
  | `other@example.com` | `Jane Doe`             |
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

- `not` / `other` / `different`

  - [REQ-083] The `not` / `other` / `different` / `unequal` modifiers (with 
    different wording options, but meaning the same) shall select the first 
    value in the example values table that is different from the condition's 
    value. I.e. for the row holding value `v`, the selected value shall be the
    first value `w` in the example values table where `w != v`.
  - [REQ-085] Regardless of which synonym (`not`, `other`, `different`,
    `unequal`) appears in the source, the derived column shall always be named
    `different $attribute-name`.
  - [REQ-141] The generator shall raise an error when the value pool for a
    `not`/`other`/`different` modifier contains fewer than two distinct values
    for the referenced attribute. The parser should validate this precondition.

  - Data example table in state machine spec:
    ```markdown
      | a  |
      |----|
      | a1 |
      | a2 |
    ```
  - Feature scenario example table:
    ```gherkin
      | a  | different a | 
      | a1 | a2          |
      | a2 | a1          |
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

- [REQ-088] Result conditions shall extend the columns.

- [REQ-089] Result conditions shall be restricted to equality operators only
  (`=`, `as`). The `resulting $attribute-name` column cell value shall be taken
  directly from `condition.value` in the AST. The generator shall raise an error
  when a result condition uses a non-equality operator.

E.g.
- Result argument `` `count = 2` `` → `resulting count` column with value `2`.
- Result argument `` `status` as `active` `` → `resulting status` column with
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
    a < 4`.
  - [REQ-145] The boundary inclusivity/exclusivity shall be encoded within the
    condition value strings themselves (e.g. the value array contains `"[1"` and
    `"4)"` for `[1, 4)`).
- [REQ-095] The generator shall support text equality forms: `as`, `not as`.
- [REQ-096] The generator shall support the unary absence check `undefined` (no
  value; checks that the attribute is absent/unset).

- [REQ-097] The operator shall be taken from AST path
  `...arguments[*].condition.operator`.
- [REQ-098] The condition value shall be taken from AST path
  `...arguments[*].condition.value`.

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

#### Result conditions

- [REQ-101] Conditions in result arguments shall potentially add additional
  columns in the examples table, under the column name 
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
- With `` `a = 1` `` on a precondition state argument and `` `a = 2` `` on the
  result argument, <br/> (``state x with `a = 1` ``, and trigger `...`, results
  in ``state x with `a = 2` ``)<br/> then scenario steps and examples table:
  ```gherkin
    Scenario Outline: [REQ-001] x "<a>" â†’ x "<resulting a>"; when e
      Given initially x "<a>"
      When e
      Then expect x "<resulting a>"
      Examples:
        | a  | resulting a |
        | 1  | 2           |
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
  ambiguous (i.e. the same state name appears in multiple machines). The
  parser's validate step enforces uniqueness, so this serves as an internal
  assertion.

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
  last.

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
  in effective step order (default preconditions first, then merged transition
  states).

- [REQ-114] The `Given` precondition steps for an expanded scenario shall
  include states from both the source (expanded) transition and the top-level
  transition.
- [REQ-115] The `Given` precondition steps for an expanded scenario shall be
  merged in effective order: default preconditions first, then the combined
  explicit transition states.
- [REQ-116] Duplicate state references (same name and same arguments) shall be
  de-duplicated, keeping the first occurrence.
  - Note it is invalid for references to share the same state name but carry
    different arguments.
- [REQ-118] A source transition shall only be considered a matching expansion
  candidate if its result state arguments match the trigger state arguments of
  the referring transition (the transition being expanded). I.e., the same
  attribute names shall be referenced, AND the
  source's result shall produce a value that satisfies the referring transition's
  trigger condition. This shall apply recursively when expansion chains through
  multiple state triggers.

  **Matching example**: Trigger condition is `user authenticated as "<email>"`.
  Source transition result is `user authenticated as "<email>"` with condition
  `email = "info@example.com"`. The source matches because it references the
  same attribute (`email`) and produces a concrete value.

  **Non-matching example**: Trigger condition is `user authenticated as "<email>"`.
  Source transition result is `user authenticated` (no arguments). The source
  does NOT match because the trigger requires an `email` argument that the
  source doesn't provide.
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

