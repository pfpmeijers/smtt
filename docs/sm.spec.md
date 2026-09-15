# State machine specification

This document defines the formalism for specifying a state machine in a
`*.state-machine.md` file.

The document uses an instructions style instead of a specification style.
For a specification of the formalism, see the [sm.ohm](../src/parse/sm.ohm) file.

> **Authoring principle** — state machine files are intended to read as natural,
> plain English. State machine names, state names, trigger names, and attribute
> names are wrapped in backticks; literal text values are wrapped in double
> quotes; everything else reads as ordinary prose. A reader unfamiliar with the
> notation should grasp the meaning of every sentence.

## File structure

Each state machine file must follow this general structure:

1.  **Title (H1)**: The name of the state machine.
2.  **Overview (Optional)**: A brief description of the state machine's
    purpose.
3.  **States (H2)**: A bulleted list of possible states, and implied data
    conditions.
4.  **Initial State**: The state in which the state machine starts.
5.  **Data (H2, Optional)**: Data associated with the state machine, with
    optional subsections — either one of:
    1. **Values (H3)**: The values each attribute may take, standing for every
       combination of them.
    2. **Value combinations (H3)**: The value combinations, as a table.
6.  **Transitions (H2)**: The rules governing state changes, with optional
    subsections:
    1. **Default preconditions (H3, Optional)**: Default precondition states.
    2. **Rules (H3)**: The transitions, as a table, as bulleted [list-form
       entries](#list-form), or both.
    3. **Impossible  (H3, Optional)**: Declared impossible state - trigger
       combinations.
    4. **Irrelevant (H3, Optional)**: Declared irrelevant state - trigger
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

Create a "States" H2 section. 

List all valid states:
- **Format**: Use a `-` bulleted list. 
- **Backticks** — Put state names between backticks.
- **Description** (optional): Use `: some text` format for additional info 
  about a state.
  - The first `:` separates the state name from the description.
  - Additional `:` characters are treated as literal text in the description
    part.
  - Use indented continuation lines for longer descriptions that do not fit on a
    single line.
- **Uniqueness**: Use unique state names across **all** state machines in
  the project.

Example:

```markdown
## States

- `User authenticated`: The user is signed in with an email address.
- `User unauthenticated`: The user is not signed in.
   Only applies when there is no active session.
```

### Implied conditions

Some states imply that a state machine's [data attribute](#Data) 
holds specific value(s). 
Declare these as indented sub-bullets under the state entry.

- **Format**: Place one implied condition per sub-bullet (indented `-`)
  immediately after the state declaration (after the description, if any). 
- **Conditions**: See [value conditions](#value-conditions) for the
  condition format as such. All condition operators are supported. 

Examples:

```markdown
## States

- `Cart empty`: The cart contains no paintings.
  - `item count` = 0
- `Reservation form filled`: All required input is present.
  - `email address` as "info@domain.com"
  - `policies` are "accepted"
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

### Value combinations

Provide explicit example values combinations as a `### Value combinations` 
heading with a table below, inside the `## Data` section,
placed after the attribute list.

- **Format**: Use column headers matching attribute names. Each row represents
  one complete combination of values across all referenced attributes:

- **Optional**: The value combinations table is optional. When an attribute is
  used in transitions or implied conditions but has no explicit example row,
  the attribute implicitly has `undefined` value as example value.
  The table is only needed to specify concrete value _combinations_.

- **Attribute list also optional**: The value combinations table may appear
  inside `## Data` without any preceding `- \`attr\`: ...` declarations.
  The column headers in the table serve as the attribute declarations in that case.

   ```markdown
   ### Value combinations

   | `email address`     | `associated user name` |
   |---------------------|------------------------|
   | "info@domain.com"   | "John Doe"             |
   | "other@example.com" |                        |
  ```

   An empty cell represents an undefined value for that attribute.
   Empty-string literals (`""`) are not allowed.

- **Quotes** — Put text-based attribute values between double quotes.
- **Numeric versus text attributes** — Numeric attributes only have
  numerical values, unquoted. Text attributes only have text values,
  always double-quoted.

---

### Values

Declare the values an attribute may take, one bullet per attribute, as a
`### Values` subsection inside `## Data`. Leaving the `### Value combinations`
table out then says that *every* combination of the declared values is a valid
one — the rows are derived rather than written by hand.

- **Format**: Use a bulleted list, one entry per attribute: the backticked
  attribute name, a `:`, then its values separated by `,`. Values follow the
  same quoting rules as a table cell — text double-quoted, numbers bare.
- **Undefined**: Write `undefined` for the absent value, where a combinations
  table leaves the cell empty, e.g. `` - `email address`: undefined,
  "info@domain.com" ``.
- **Attribute list optional**: A `### Values` entry declares its attribute, the
  way a table column header does, so the `- \`attr\`: ...` list above it is
  only needed to attach descriptions or fix the ordering.
- **Alternative to the table**: `### Values` and a `### Value combinations`
  table are alternatives, not a pair. Use `### Values` when every combination
  is valid; use the table when the values have to be paired into rows by hand.
  Declaring both is an error.
- **Derived rows**: Combinations are laid out with the last-declared attribute
  varying fastest. At most 1000 combinations may be derived; beyond that,
  reduce the values or write the table out.

Example:

```markdown
## Data

- `language`: The language the document is written in.
- `revision`: The document's revision number.

### Values

- `language`: "en", "nl", "de"
- `revision`: 1, 2
```

This is the same as writing all six combinations out:

```markdown
### Value combinations

| `language` | `revision` |
|------------|------------|
| "en"       | 1          |
| "en"       | 2          |
| "nl"       | 1          |
| "nl"       | 2          |
| "de"       | 1          |
| "de"       | 2          |
```

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
- **Backticks and quotes** — Put the state names and any referenced attribute
  names between backticks, and any literal text values between double quotes.
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
  - **#** (optional): An optional unique string identifier for the transition 
    across all state machines, e.g., `001`, `T01a`.
  - **States**: The combined state: all precondition states (external 
    state machines) and the state machine's own precondition state, separated 
    by `,`. 
  - **Trigger**: The trigger that initiates the transition.                      
  - **Result**: The resulting state after the transition.                     
  - **Notes** (optional): Additional context or side effects.                

- **Condition/result-value auto-inference**: When a condition in a state
  definition, default precondition or transition (or a transition's Result
  cell [result value](#result-values)) references a value
  (e.g. `` `attr` = "foo" `` or `` `attr` set to "foo" ``) that is not already
  present in the example values table, that value is part of the implied
  example combinations. For multiple conditions/result values on the same
  transition (e.g. `` `a` = "foo" and `b` = "bar" ``), a single combined row
  is implied with all required values; all other attributes in that row
  take the first available value from the existing table, or an empty
  (undefined) value if the table has no prior rows.

  Example — the following transition with no prior example rows:

  ```markdown
  ## States

  - `idle`
  - `active`
    - `status` = "running"

  ## Transitions

  ### Rules

  | States   | Trigger                                             | Result   |
  |----------|-----------------------------------------------------|----------|
  | `idle`   | `started` with `status` = "running" and `count` = 0 | `active` |
  ```

  This implies the following example value row:

  ```markdown
  | `status`  | `count` |
  |-----------|---------|
  | "running" | 0       |
  ```

Example:

```markdown
| # | States                                       | Trigger                  | Result               | Notes |
|---|----------------------------------------------|--------------------------|----------------------|-------|
|   | `User session present`, `painting available` | `Painting added to cart` | `Painting in cart`   |       |
|   | `Painting in cart`                           | `Painting removed`       | `Painting available` |       |
```

#### List form

As an alternative to a table row, write a single transition as a nested
bulleted entry. Both notations may appear anywhere under `### Rules`, in any
order and any number of times — every table row and every list entry is
merged into one combined list of transitions.

- **Format**: Start the entry with `- <id>:`, then nest four sub-bullets, in
  this order: `States`, `Trigger`, `Result`, and (optionally) `Notes`.
- **Identifier**: Unlike the table's optional `#` column, the identifier is
  required on a list entry — it is the only thing that labels the entry.
  Write it as plain text, not backticked.
- **Description** (optional): Write `: some text` directly after the id,
  in the same format used for a [state description](#states) or a
  [default precondition description](#default-preconditions). It is folded
  into the transition's `Notes`, ahead of any text from an explicit `Notes:`
  sub-bullet.
- **States**: List one state reference per sub-bullet, in place of the
  table's `,`-separated cell. Each bullet uses the same [state
  reference](#multiple-states-in-the-state-column) syntax as a table cell —
  arguments, [modifiers](#data-modifiers), and [value
  conditions](#value-conditions) all work the same way.
- **Trigger** and **Result**: Exactly one sub-bullet each, holding the same
  [trigger](#trigger-types)/[result](#result-values) syntax as the
  corresponding table cell.
- **Notes** (optional): One or more sub-bullets of free text, equivalent to
  the table's `Notes` cell. Multiple bullets are joined with a space.
- **Wrapping long lines**: A sub-bullet's value may continue onto further
  physical lines for readability. A continuation line must be indented
  further than its bullet and must not itself start with `-`; it is joined
  onto the previous line with a single space before being parsed.

Example — the following list-form entry is equivalent to a single table row:

```markdown
### Rules

- 039c:
  - States:
    - `User session present`
    - `User authenticated` with `user email address`
    - `Painting in cart` with `painting assignee email address` as `user email address`
  - Trigger:
    - `Painting reservation confirmed` using
      `reservation email address` <> `user email address` and `reservation name`
  - Result:
    - `Painting reserved` for `reservation email address` and `reservation name`
       and `painting email address` set to `reservation email address`
  - Notes:
    - Reservation confirmed using new email address
```

With an inline description instead of (or alongside) a `Notes:` sub-bullet:

```markdown
- 040: Removing painting from cart.
  - States:
    - `User session present`
    - `Painting in cart`
  - Trigger:
    - `Painting removed from cart`
  - Result:
    - `Painting available`
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

##### A second value of the same kind

When a transition needs a second value alongside an attribute's current one —
a new identifier, a replacement address, a competing bid — declare it as an
attribute of its own and reference it plainly. The example values table then
states how the two relate, row by row.

- **Naming**: Give the second attribute a name that reads naturally in the
  sentence, e.g. `new email address` beside `email address`.
- **Relating the values**: Pair the values per row in the example values table.
  Writing a different value in each column of a row is what makes the two
  differ; the values are the author's to choose.

Example:

```markdown
## Data

- `email address`: The address the user is signed in under.
- `new email address`: The address the user re-signs in under.

### Value combinations

| `email address`   | `new email address` |
|-------------------|---------------------|
| "info@domain.com" | "other@example.com" |
| "other@example.com" | "info@domain.com" |
```

- State: `` `User authenticated` with `email address` ``
- Trigger: `` `User re-signed in` with `new email address` `` — the user
  authenticates under the address the row pairs with the current one.

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
Value conditions apply to `States` cell and `Trigger` cell arguments (and to
state implied conditions and default preconditions); a `Result` cell argument
instead uses [result values](#result-values), a separate `set to` syntax.

A condition value may also be an
[attribute reference](#attribute-reference-values) instead of a literal — the
condition then compares the attribute against another attribute's value rather
than against a fixed one.

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

- **Range brackets** — A square bracket includes the bound, a round bracket
  excludes it, so `` `score` in [10, 20) `` reads as `10 <= score < 20`. Write
  at least one square bracket: `[low, high]`, `[low, high)` and `(low, high]`
  are ranges, while `(low, high)` is the set form below — both spellings use
  `in`, so the brackets are what tell a range from a set.

Supported text condition operators:

| Syntax                                    | Meaning                                        |
|-------------------------------------------|------------------------------------------------|
| `` `attribute` is "value" ``              | Attribute equals `"value"` (synonym for `=`)   |
| `` `attributes` are "values" ``           | Attribute equals `"value"` (synonym for `=`)   |
| `` `attribute` is not "value" ``          | Attribute is not equal to `"value"` (as `<>`)  |
| `` `attributes` are not "values" ``       | Attribute is not equal to `"value"` (as `<>`)  |
| `` `attribute` in ("v1", "v2", ...)``     | Attribute is one of the listed values (set)    |
| `` `attribute` not in ("v1", "v2", ...)`` | Attribute is none of the listed values (set)   |
| `` `attribute` undefined``                | Attribute has no value                         |
| `` `attribute` is undefined``             | Attribute has no value (alias of `undefined`)  |
| `` `attribute` defined``                  | Attribute has a value                          |
| `` `attribute` is defined``               | Attribute has a value (alias of `defined`)     |

The `as` operator is deliberately absent from these tables: it does not compare.
See [Sameness](#sameness) below.

##### Sameness

`` `attribute` as <value> `` does not test anything — it states that the
attribute **is** that value. The attribute takes it, whether it is a literal or
an [attribute reference](#attribute-reference-values):

| Syntax                              | Meaning                                            |
|-------------------------------------|----------------------------------------------------|
| `` `attribute` as "value" ``        | The attribute holds `"value"`                      |
| `` `attribute` as `other attr` ``   | The attribute holds whatever `other attr` holds    |

The distinction from `is` matters as soon as two state machines are involved.
`` `a` is `b` `` asks for a row in which `a` and `b` happen to hold the same
text, so such a row has to exist. `` `a` as `b` `` needs no such row: `a` is
*given* `b`'s value. Two machines can therefore relate their attributes without
either having to declare a literal that coincides with the other's — which no
author can reliably arrange, since which machine's values apply depends on an
expansion the author does not write.

Use `as` to say two things are the same thing, and `is` / `=` to test a value.

Example:

- `` `Painting in cart` with `assignee email address` as `user email address` ``
  — the painting in the cart is *this* user's; its assignee email is the
  authenticated user's email, whatever that is.
- `` `Painting in cart` with `assignee email address` is "info@domain.com" ``
  — only applies to rows where the assignee email is exactly that address.

A sameness on an attribute that also carries a
[modifier](#data-modifiers) is the one exception: it constrains a derived value
(e.g. the next in sequence) rather than the attribute's own cell, so it is
tested like any other condition.

##### Values

- **Name values** — A number (plain) or text value (double-quoted), taken from
  the declared example values in the data section.
- **Quotes** — Put literal text values between double quotes.
- **Empty strings** — Empty quoted strings (`""`) are not allowed.
- **Text-value character set** — A quoted text value may contain any
  character except a double quote or a line break.
- **Attribute reference** — A *backticked* value (not quoted) is not a literal
  at all — it names another data attribute and is instead an
  [attribute reference](#attribute-reference-values). The backtick delimiter
  makes this distinction syntactic: no name-matching is involved. Both a
  condition value and a [result value](#result-values) may be a reference.

##### Condition semantics

Depending on the column the condition is used in, it represents a
precondition or a trigger constraint.

- **`States` cell** — a condition is a precondition: the transition only
  applies when the attribute currently holds a value satisfying the condition.
  Rows with different conditions on the same attribute represent distinct,
  mutually exclusive cases.

- **`Trigger` cell** — a condition constrains the incoming event's associated
  data value. The transition fires only when the triggering event carries a
  value that satisfies the condition.

Example:

- `` `Cart filled` with `item count` > 1`` — precondition: the cart has multiple
  items.

#### Result values

A **result value** sets the value an argument in the `Result` cell takes on
after the transition — a postcondition. Unlike a value condition, it is
always a plain equality assignment, so there is no operator to choose between:
write `set to` after the attribute name, followed by a value, an attribute
reference, or `undefined`.

| Syntax                                  | Meaning                                                                                                      |
|-----------------------------------------|--------------------------------------------------------------------------------------------------------------|
| `` `attribute` set to value ``          | Attribute is set to numerical `value`                                                                        |
| `` `attribute` set to "value" ``        | Attribute is set to string `"value"`                                                                         |
| `` `attribute` set to `other attr` ``   | Attribute is set to `other attr`'s own value (see [attribute reference values](#attribute-reference-values)) |
| `` `attribute` set to undefined ``      | Attribute is set to undefined (absent)                                                                       |

Values follow the same [Values](#values) rules as a value condition — numbers
plain, text quoted, empty quoted strings not allowed.

Example:

- `` `Cart empty`, so `item count` set to 0`` — postcondition: the cart is
  empty after the transition.

#### Attribute reference values

A condition value or a result value may name a data attribute instead of a
literal — the value is then resolved dynamically, from that other attribute's
own value, rather than being fixed.

- **Disambiguation** — Syntactic, by delimiter: a backticked value is always a
  reference; a double-quoted (or bare numeric) value is always a literal. No
  name-matching is involved.
- **Target** — The referenced name must be a data attribute declared (or
  inferred from usage) in *some* state machine in the project — not
  necessarily the one owning the reference. Naming an attribute that exists
  nowhere is an error.
- **As a result value** — On a `Result` cell, the reference is the value the
  attribute takes on after the transition (a postcondition).
- **As a condition value** — In a `States` cell, a `Trigger` cell, a state
  implied condition, or a default precondition, the reference is what the
  attribute is compared against: both values are read from the same example
  combination, so the condition relates two attributes rather than pinning one
  to a literal.
- **Operators** — A reference is only supported on `as` (sameness) and on the
  scalar comparison operators: `=`, `<>`, `<`, `>`, `<=`, `>=`, `is`, `are`,
  `is not`, `are not`. The set (`in (…)`), range (`in [low, high]`) and
  presence (`defined` / `undefined`) forms compare against fixed values and
  reject a reference.

Example:

```markdown
## Data

- `list price`
- `sale price`

## Transitions

### Rules

| States                              | Trigger         | Result                                                |
|-------------------------------------|-----------------|-------------------------------------------------------|
| `Painting listed` with `list price` | `Painting sold` | `Painting sold` with `sale price` set to `list price` |
```

After `Painting sold`, `sale price` takes on whatever value `list price`
currently holds for that scenario — a dynamic postcondition, rather than one
fixed literal value.

##### Implied attribute and values

Referring to an attribute with `as` or `=` also *defines* the constrained
attribute, so it needs no declaration of its own:

- The attribute is added to the data attributes of the state machine, exactly
  as any other attribute reference in a transition does.
- With `as`, its value simply *is* the referenced attribute's, resolved per
  scenario. Nothing has to be declared or pre-arranged.
- With `=`, a row in which both attributes hold the same value must exist for
  the comparison to ever hold, so one is implied from the referenced
  attribute's own declared values.

The other operators say what a value must *not* be (`<>`, `is not`), or state
an open-ended relation (`<`, `>`, `<=`, `>=`), so no value follows from them —
give the attribute its own example values when using those.

Note the asymmetry when the referenced attribute belongs to **another** state
machine. A machine must be specifiable stand-alone, so another machine's table
is never drawn on for a plain precondition (only along an expansion chain).
With `=` that means declaring example values for the constrained attribute in
this machine — and since the other machine's values are not consulted, the two
cannot be made to coincide deliberately. With `as` there is nothing to
coincide: the value is taken from whichever attribute is authoritative in the
scenario being generated, so the same rule reads correctly whether the machine
is generated on its own or reached through another machine's transition.

Example:

```markdown
## Data

- `list price`

### Values 

- `list price`: 10, 20

## Transitions

### Rules

| States                              | Trigger                                 | Result             |
|-------------------------------------|-----------------------------------------|--------------------|
| `Painting listed` with `list price` | `Bid placed` with `bid` as `list price` | `Painting offered` |
```

`bid` is neither declared under `## Data` nor given example values, yet the
transition covers the combinations where `bid` equals `list price`: `bid` 10
with `list price` 10, and `bid` 20 with `list price` 20.

Note that the referenced attribute only appears as a column of the generated
example values when the transition also mentions it as an argument — as
`` with `list price` `` does above.

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

| States                | Trigger                          |
|-----------------------|----------------------------------|
| `User session absent` | `Signed in` with `email address` |
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

| States               | Trigger                          |
|----------------------|----------------------------------|
| `Painting archived`  | `Signed in` with `email address` |
| `Painting available` | `Signed in` with `email address` |
```

This states that signing in has the same authenticated result no matter what
painting state is active — the painting's state is not a discriminating factor
for user authentication and these combinations need not be specified separately.

---

## Backtick and quote convention

Backticks and double quotes delimit tokens for parser disambiguation, and the
choice of delimiter is meaningful: a backticked token always *names* something
(a state machine, state, trigger, or attribute — or, as a condition or result
value, an [attribute reference](#attribute-reference-values)); a double-quoted
token is always a literal text value.

- **Required targets**: State machine names, state names, trigger names, and
  attribute names are always backticked. Literal text-based attribute values
  are always double-quoted.
- **Title exception**: The H1 state machine name is plain text (not backticked).
- **Numeric values**: Numeric attribute values are never quoted or backticked.
- **Quoted numerals are text**: A quoted numeral (for example, `"42"`) is
  interpreted as a text value, and therefore only text-based conditions are
  valid for it. A *backticked* numeral (`` `42` ``) is instead an attribute
  reference naming an attribute called `42`.

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
- `new name`

## Transitions

### Default preconditions

- `Other state inactive`

### Rules

| States                                       | Trigger              | Result                           | Notes |
|----------------------------------------------|----------------------|----------------------------------|-------|
| `State A`                                    | `Event X`            | `State B`                        |       |
| `State B`                                    | `Other state active` | `State A`                        |       |
| `Other state active` under `name`, `State A` | `Event Y` for `name` | `State B` under `new name`       |       |
| `State A` with `count` > 0                   | `Event Z`            | `State B`                        |       |
```

---


