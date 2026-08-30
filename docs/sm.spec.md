# State machine specification

This document defines the formalism for specifying state machines in
`*.state-machine.md` files.

> **Authoring principle** — state machine files are intended to read as natural,
> plain English. State names, attribute names, and text values are wrapped in 
> backticks; everything else reads as ordinary prose. A reader unfamiliar with 
> the notation should grasp the meaning of every sentence.

## TODO:
- For result argument conditions, only operators allowed that lead to an 
  unambiguous value to be filled in `resulting <attribute` column is ambiguous.
  This mean only the "=" or "as" (and its aliases) (?)

## File structure

Each state machine file should follow this general structure:

1.  **Title (H1)**: The name of the state machine.
2.  **Overview (Optional)**: A brief description of the state machine's 
    purpose.
3.  **States (H2)**: A bulleted list of possible states.
4.  **Initial State**: The state in which the machine starts.
5.  **Data (H2, Optional)**: Data associated with the state machine.
6.  **Transitions (H2)**: The rules governing state changes, with optional 
    subsections:
    1. **Default preconditions (H3, Optional)**: Default precondition states per
       dependent machine.
    2. **Rules (H3)**: The transitions table.
    3. **Impossible  (H3, Optional)**: Declared impossible trigger-state
       combinations.
    4. **Irrelevant (H3, Optional)**: Declared irrelevant trigger-state
       combinations.
7.  **Notes (H2, Optional)**: Additional information.

Each main section (H2) may also contain an optional `### Notes` subsection for
section-scoped annotations.

---

## Title

Create a title heading with the state machine name.

- **H1 format** — Write only the state machine name in the H1. Do not add
  backticks or extra text.

Examples: 
```markdown
# User session
```

---


## States

List all valid states.

- **Format**: Use a bulleted list.
- **Backticks** — Put state names between backticks.
- **Description** (optional): Use `: some text` format for additional info 
  about a state.
  - Use the first `:` to separate the state name from the optional description.
  - Additional `:` characters will be treated as literal text in the description
    part.
  - Use indented continuation lines for longer descriptions that do not fit on a
    single line.
- **Uniqueness**: Use unique state names across **all** state machines in
  the project.

Example:

```markdown
## States

- `User authenticated`: The user is signed in with his email address.
- `User unauthenticated`: The user is not signed in.
  Only applies when there is no active session.
```

### Implied conditions

Some states imply that a data attribute (explained below) holds a specific 
value. Declare these as indented sub-bullets under the state entry.

- **Format**: Place one implied condition per sub-bullet (` - ` prefixed
  with two spaces of indentation) immediately after the state declaration
  (after the description, if any).
  the `## Data` section. 
- **Attribute name**: Write the full attribute name as declared in
- **Backticks** — Put attribute names and text values between backticks.
- **Supported operators**: All [value condition operators](#value-conditions) 
  are supported.

Examples:

```markdown
## States

- `Cart empty`: The cart contains no paintings.
  - `item count` = 0
- `Reservation form filled`: All required input is present.
  - `email address` as `info@domain.com`
  - `policies` are `accepted`
- `Reservation form unfilled`
  - `email address` undefined
- `Painting sold`
  - `sale price` > 0
```

### Initial state

Specify the starting state.

- **Format**: Use the format ``Initial state: `state name` ``.
- **Backticks** — Put the initial state name between backticks.
- **Optional** — When the `Initial state:` line is omitted, the first state
  listed under `## States` is used as the initial state. Declaring it
  explicitly is recommended for clarity.

Example:

```markdown
Initial state: `User unauthenticated`
```

---

## Data

Define data attributes associated with the state machine.

- **Format**: Use a bulleted list.
- **Backticks** — Put the attribute names between backticks.
- **Description** (optional): Use `: some text` format for additional info 
  about an attribute, in same way as for states.
- **Optional**: The `## Data` attribute list is optional. Any attribute
  referenced in a transition argument, state implied condition, or default
  precondition argument is automatically inferred from usage. Explicit
  declarations are only needed to attach a description or to control the
  ordering of attributes in the generated output.
- **None**: Write `None` when the state machine has no data entities, or omit
  the `## Data` section entirely. Both have the same effect.

Example:

```markdown
## Data

- `email address`: The user's email.
- `user name`: The associated first and last name of the user.
```

---

### Data values

Provide example values using a combination table inside `## Data`, placed after
the attribute list.

- **Format**: Use column headers matching attribute names. Each row represents
  one complete combination of values across all referenced attributes:

- **Optional**: The example values table is optional. When an attribute is
  used in transitions or implied conditions but has no explicit example row,
  the attribute implicitly has `undefined` value as example value.
  The table is only needed to specify concrete value _combinations_.

- **Attribute list also optional**: The example values table may appear
  inside `## Data` without any preceding `- \`attr\`: ...` declarations.
  The column headers in the table serve as the attribute declarations in that case.

   ```markdown
   Example values:

   | `email address`     | `associated user name` |
   | ------------------- | ---------------------- |
   | `info@domain.com`   | `John Doe`             |
   | `other@example.com` |                        |
   ```

   An empty cell represents an undefined value for that attribute.
   Empty-string literals (`` `` ``) are not allowed.

- **Backticks** — Put text-based attribute values between backticks.
- **Numeric versus text attributes** — Numeric attributes only have
  numerical values, non backticked. Text attributes only have text values,
  always backticked.

---

## Transitions

Define how the machine transitions between states based on triggers.

### Default preconditions

Declare default precondition states per dependent state machine.

- **Format**: Use a bulleted list. Each entry is a state reference — the same
  structure used for state references in the transition table (see
  [State reference](#multiple-states-in-the-state-column)), including any
  optional [arguments](#data-linking), [modifiers](#data-modifiers), or
  [value conditions](#value-conditions).
- **Backticks** — Put the state names and any referenced attribute names or
  text values between backticks.
- **Description** (optional):  Use `: some text` format for additional info
  about the precondition, in same way as for other descriptions.
- **Behavior**: Consider the listed default state (with its arguments, if any)
  as prepended to every transition rule that does not explicitly mention a
  state belonging to this same state machine.
- **Controlling order**: Declare multiple default preconditions in their 
  intended order.
- **Empty block**: Write `None` below `### Default preconditions` when there are
  no entries, or omit the block entirely. Both have the same effect.

Example:

```markdown
## Transitions

### Default preconditions

- `User session present`: The user must have a valid active session. This is
  prepended to all transition rules' precondition state unless overridden.
- `User authenticated` with `user@domain.com`
```

This example implies every transition to have `User session present`
and `User authenticated` with `user@domain.com` as the first preconditions
unless its `State` cell already mentions any user session state.

### Transition rules

- **Format**: Use a Markdown table with columns: 
  - **#** (optional): An optional unique number (identifier) for the transition 
    accross all state machines, e.g., `001`.
  - **States**: The combined state: all precondition states (external 
    state machines) and the state machine's own precondition state, separated 
    by `,`. 
  - **Trigger**: The trigger that initiates the transition.                      
  - **Result**: The resulting state after the transition.                     
  - **Notes** (optional): Additional context or side effects.                

- **Condition-value auto-inference**: When a condition in a state definition, 
  default precondition or transition references a value 
  (e.g. `` `attr` = `foo` ``) that is not already present
  in the example values table, that value is part of the implied example
  combinations. For multiple conditions on the same transition
  (e.g. `` `a` = `foo` and `b` = `bar` ``), a single combined row is implied
  with all required values; all other attributes in that row
  take the first available value from the existing table, or an empty
  (undefined) value if the table has no prior rows.

  Example — the following transition with no prior example rows:

  ```markdown
  ## States

  - `idle`
  - `active`
    - `status` = `running`

  ## Transitions

  ### Rules

  | States   | Trigger                                             | Result   |
  |----------|-----------------------------------------------------|----------|
  | `idle`   | `started` with `status` = `running` and `count` = 0 | `active` |
  ```

  This implies the following example value row:

  ```markdown
  | `status`  | `count` |
  |-----------|---------|
  | `running` | 0       |
  ```

Example:

```markdown
| # | States                                       | Trigger                  | Result               | Notes |
|---|----------------------------------------------|--------------------------|----------------------|-------|
|   | `User session present`, `painting available` | `Painting added to cart` | `Painting in cart`   |       |
|   | `Painting in cart`                           | `Painting removed`       | `Painting available` |       |
```

#### Multiple states in the State column

The **State** column combines multiple states using `,` as separator. The
order matters: listing A before B before C implies that A was reached before or
together with B, and B before or together with C. They jointly form the combined 
state A-B-C.

```
`Default user identity available` from `email address`, `user session absent`, `user unauthenticated`
```
- **State separator**: Use `,` as the separator between states.
- **Backticks** — Put the state names between backticks.

#### Trigger types

Two kinds of triggers exist:

- **Event-trigger** — an externally driven event such as a user action, browser
  event, or administrative action. Write the trigger text between backticks.
  It must **not** match any known state name.
  Examples: `First page opened`, `Signed in with email adress`,
  `Browser's local storage cleared`

- **State-trigger** — fires when another state machine enters a specific state.
  Write the state's name between backticks.

#### Data linking

To specify data-aware transitions, use references to data attributes defined in 
the **Data** section as state or trigger arguments.

- **Format**: A reference to an attribute name as suffix to the state or event text.
- **Backticks**: Put the attribute references between backticks.
- **Qualifier**: Use preposition words like `as`, `for`, etc., preceding the attribute
  reference for human-friendly reading — they carry no formal meaning.
- **Multiple arguments**: Specify multiple arguments if relevant, separated by `and`.
  Don't use `,` as this is reserved to split states.

Examples:

- `User authenticated` with `email address`
- `Painting reserved` for `user name`

These refer to states `User authenticated` and `Painting reserved`, 
and data attributes `email address` and `user name`. 

#### Data modifiers

Use **modifier** keywords before an argument.
This describes the relationship between the value at that point in the
transition and the value of the same attribute established elsewhere in the same
transition context.

##### Negation modifiers: `not` / `different` / `unequal` / `other`

The value is the first value other than the one the attribute currently holds (as
declared by the corresponding reference in the same transition row).

- Semantics: the attribute value is different from the attribute value used 
  elsewhere in the same transition rule.
- When this modifier is used, there shall be at least one other value specified
  for the attribute in the example values table (at least two distinct values in total).
- The first different value from the example values table is taken for the scenario.
- All these keywords are synonyms.

Examples:

- State: `` `User authenticated` with `email address` ``
- Trigger: `` `User re-signed in` with different `email address` ``. 
  Semantics: the user authenticated under a different email address than   
  the one referenced in the precondition.

##### Sequence modifiers: `next` / `previous` / `first` / `last`

The attribute value is selected from the ordered sequence of known values for
that attribute, as declared in the `## Data` values table.

- `next`: the next item in the sequence (circular).
- `previous`: the previous item in the sequence (circular).
- `first`: the first item in the sequence.
- `last`: the last item in the sequence.

- Semantics: the result value is selected by sequence position relative to the
  current value (`next`/`previous`) or by absolute sequence boundary
  (`first`/`last`).
- Use these when the domain has a meaningful cycle (e.g., phases, turns, ranked
  items).

Example:

- `` `Season reset` to first `season` `` — the season moves to the first 
  declared value.
- `` `Season changed` to next `season` `` — the season advances to the next one
  in the defined sequence.

##### Numeric modifiers: `incremented` / `decremented`

The attribute value is exactly one unit greater (`incremented`) or one unit less
(`decremented`) than the current value.

- Semantics: the attribute is numeric and its value changes by exactly one.
- Only valid for attributes whose declared example values are numeric.

Examples:

- `` `Cart now has` incremented `item count` `` — one more item than before.
- `` `Cart now has` decremented `item count` `` — one fewer item than before.

#### Value conditions

A **value condition** constrains the argument to a specific subset of its
possible values. Write the condition expression after the attribute name.

Supported numerical condition operators:

| Syntax                              | Meaning                                                       |
|-------------------------------------|---------------------------------------------------------------|
| `` `attribute` = value``            | Attribute equals `value`                                      |
| `` `attribute` <> value``           | Attribute is not equal to `value`                             |
| `` `attribute` > value``            | Attribute is strictly greater than `value`                    |
| `` `attribute` < value``            | Attribute is strictly less than `value`                       |
| `` `attribute` >= value``           | Attribute is greater than or equal to `value`                 |
| `` `attribute` <= value``           | Attribute is less than or equal to `value`                    |
| `` `attribute` in [low, high]``     | Attribute falls within the inclusive <br/>range `low`–`high`  |
| `` `attribute` not in [low, high]`` | Attribute falls outside the inclusive <br/>range `low`–`high` |

Supported text condition operators:

| Syntax                                    | Meaning                                           |
|-------------------------------------------|---------------------------------------------------|
| `` `attribute` as `value` ``              | Attribute equals `` `value` ``                    |
| `` `attribute` is `value` ``              | Attribute equals `` `value` `` (synonym for `as`) |
| `` `attributes` are `values` ``           | Attribute equals `` `value` `` (synonym for `as`) |
| `` `attribute` not as `value` ``          | Attribute is not equal to `` `value` ``           |
| `` `attribute` is not `value` ``          | Attribute is not equal to `` `value` ``           |
| `` `attributes` are not `values` ``       | Attribute is not equal to `` `value` ``           |
| `` `attribute` in (`v1`, `v2`, ...)``     | Attribute is one of the listed values (set)       |
| `` `attribute` not in (`v1`, `v2`, ...)`` | Attribute is none of the listed values (set)      |
| `` `attribute` undefined``                | Attribute has no value                            |
| `` `attribute` is undefined``             | Attribute has no value (alias of `undefined`)     |

##### Values

- **Name values** — A number (plain) or text value (backticked), taken from the
  declared example values in the data section.
- **Backticks** — Put text values between backticks.
- **Empty strings** — Empty backticked strings (`` `` ``) are not allowed.
- **Text-value character set** — A backticked text value may contain any
  character except a backtick or a line break.

##### Condition semantics

Depending on the column the condition is used in, it represents a
precondition, trigger constraint or postcondition.

- **`States` cell** — a condition is a precondition: the transition only
  applies when the attribute currently holds a value satisfying the condition.
  Rows with different conditions on the same attribute represent distinct,
  mutually exclusive cases.

- **`Trigger` cell** — a condition constrains the incoming event's associated
  data value. The transition fires only when the triggering event carries a
  value that satisfies the condition.

- **`Result` cell** — a condition is a postcondition: after the transition the
  attribute will hold a value satisfying the condition. Where multiple result
  values are possible the condition narrows them down; where a single value is
  implied by context the condition makes that explicit.

Examples:

- `` `Cart filled` with `item count` > 1`` — precondition: the cart has multiple
  items.
- `` `Cart empty`, so `item count` = 0`` — postcondition: the cart is
  empty after the transition.

### Impossible state-trigger combinations

Some triggers are semantically impossible under certain state combinations —
they simply cannot occur in that state combination by definition of the domain.
The model captures these impossibilities in two complementary ways: **declared**
(explicit author intent) and **inferred** (closed-world inference).

Add an optional `### Impossible` block to declare
which triggers cannot fire under which preconditions.

- **Format**: A Markdown table with columns `State` (precondition) and 
  `Trigger`. 
- **States cell**: List the state(s) that make the trigger impossible. 
  Use `,` to combine multiple states into a single condition.
- **Trigger cell**: Write the trigger that cannot occur under those preconditions.
- **Backticks**: Put the state names between backticks.
- **Empty block**: Write `None` below `### Impossible` when there are no
  declared entries, or omit the block entirely. Both have the same effect.

Example:

```markdown
### Impossible

| States                | Trigger                     |
| --------------------- | --------------------------- |
| `User session absent` | `Signed in with email adress` |
```

This states that "Signed in with email address" cannot occur when there is no
active session — a signing-in action is only possible within an established
browser session.

#### Irrelevant state-trigger combinations

Add a `### Irrelevant` block to declare which triggers produce the same
outcome regardless of the listed state — the state is simply not a
discriminating factor.

- **Format**: Use a Markdown table with columns `State` and `Trigger`. 
- **States cell**: List the state(s) that make the listed trigger irrelevant.
  Use `,` to combine multiple states into a single condition.
- **Trigger cell**: Write the trigger whose outcome does not depend on that state.
- **Backticks**: Put the state names between backticks.
- **Empty block**: Write `None` below `### Irrelevant` when there are no
  declared entries, or omit the block entirely. Both have the same effect.

Example:

```markdown
### Irrelevant

| States               | Trigger                     |
| -------------------- | --------------------------- |
| `Painting archived`  | `Signed in` with `email adress` |
| `Painting available` | `Signed in` with `email adress` |
```

This states that signing in has the same authenticated result no matter what
painting state is active — the painting's state is not a discriminating factor
for user authentication and these combinations need not be specified separately.

---

## Backtick convention

Backticks delimit identifiers for parser disambiguation.

- **Required targets**: State machine names, state names, trigger names, 
  attribute names, and text-based attribute values are always backticked.
- **Title exception**: The H1 state machine name is plain text (not backticked).
- **Numeric values**: Numeric attribute values are never backticked.
- **Backticked numerals are text**: A backticked numeral (for example,
  `` `42` ``) is interpreted as a text value, and therefore only text-based
  conditions are valid for it.

---

## Developer comments

Comments record tasks and known issues directly inside a state machine
file, without affecting parsing or code generation.

- **Format**: Start a line with `//` followed by any text.
- **Placement**: Place a comment between any two structural
  elements (before or after any section, between list items, within table 
  cells, etc.).
- **Stripped before processing**: Expect developer comments to be discarded
  before any semantic interpretation; they are invisible to the state 
  machine model.

Example:

```markdown
// TODO: Verify whether the implicit sign in path also applies when the identity is stale.
```

---

## Example

```markdown
# Example state machine


## States

- `State A`
- `State B`

Initial state: `State A`

## Data

- `name`

## Transitions

### Default preconditions

- `Other state inactive`

### Rules

| States                                       | Trigger              | Result                           | Notes |
|----------------------------------------------|----------------------|----------------------------------|-------|
| `State A`                                    | `Event X`            | `State B`                        |       |
| `State B`                                    | `Other state active` | `State A`                        |       |
| `Other state active` under `name`, `State A` | `Event Y` for `name` | `State B` under different `name` |       |
| `State A` with `count` > 0                   | `Event Z`            | `State B`                        |       |
```

---


