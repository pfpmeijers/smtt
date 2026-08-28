// This file exercises section ordering and optional section variants.

# Note variations machine

This state machine validates layout-oriented combinations. It includes notes
subsections and plain trailing notes.

Dependencies are intentionally omitted.

## States

- `To be started`
- `Draft`: First step before review.
  Extra state description line to exercise continuation parsing.
- `Review`: Intermediate state for confirmation.
- `Published`: Final state visible to users.

Initial state: `To be started`

### Notes

States contain an indented continuation line.

## Data

None

### Notes

No data entities are needed for this machine.

## Transitions

### Default preconditions

None

### Rules

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
