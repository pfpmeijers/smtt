# List form transitions

Exercises the bulleted list-form alternative for transition rules: mixed
with the table form in the same Rules subsection, an inline id description,
a multi-bullet Notes block, and a value wrapped onto a continuation line.

## States

- `Listed idle`
- `Listed active`: The counter is running.

Initial state: `Listed idle`

## Data

- `list count`: Running count.

Example values:

| `list count` |
|---------------|
| 0             |
| 1             |

## Transitions

### Rules

| States        | Trigger        | Result          | Notes     |
|---------------|----------------|------------------|-----------|
| `Listed idle` | `List started` | `Listed active` | Table row |

- 002:
  - States:
    - `Listed active` with `list count` = 0
  - Trigger:
    - `List counted` with
      `list count` > 0
  - Result:
    - `Listed active` with incremented `list count`
  - Notes:
    - List-form entry
    - with two note bullets

- 003: Reset back to idle.
  - States:
    - `Listed active`
  - Trigger:
    - `List reset`
  - Result:
    - `Listed idle`
