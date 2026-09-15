// This file exercises section ordering, optional section variants, and free-form headings.

# Note variations machine

This state machine validates layout-oriented combinations. It includes notes
subsections and plain trailing notes.

#### Scope

Dependencies are intentionally omitted.

## States

#### Early states

- `To be started`
- `Draft`: First step before review.
  Extra state description line to exercise continuation parsing.

#### Later states

- `Review`: Intermediate state for confirmation.
- `Published`: Final state visible to users.

#### Starting point

Initial state: `To be started`

### Notes

States contain an indented continuation line. Free-form `####` headings subdivide
this file's sections without carrying any meaning of their own.

## Data

None

### Notes

No data entities are needed for this machine.

## Transitions

### Default preconditions

None

### Rules

##### The whole lifecycle

| # | States          | Trigger             | Result      |
|---|-----------------|---------------------|-------------|
| 1 | `To be started` | `Started`           | `Draft`     |
| 2 | `Draft`         | `Reviewing started` | `Review`    |
| 3 | `Review`        | `Confirmed`         | `Published` |

### Impossible

None

### Irrelevant

None

### Notes

Transition subsections use the `None` keyword variants.

Notes: Plain trailing notes. Including state references, e.g. draft.
