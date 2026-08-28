# Mode

Exercises pure own-state impossibility inference with no external dependencies.
Each trigger is handled by exactly one state, so the other state is always inferred impossible.

## States
- `Mode active`: System is currently active.
- `Mode inactive`: System is currently inactive.

Initial state: `Mode inactive`

## Data
None

## Transitions

### Rules

| States          | Trigger       | Result          | Notes |
|-----------------|---------------|-----------------|-------|
| `mode inactive` | `Activated`   | `Mode active`   |       |
| `mode active`   | `Deactivated` | `Mode inactive` |       |

