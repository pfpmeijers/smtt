# Alpha machine

## States
- `Idle`
- `Active`

## Transitions

### Rules
| States   | Trigger | Result   | Notes      |
|----------|---------|----------|------------|
| `Idle`   | `Start` | `Active` | first row  |
| `Active` | `Stop`  | `Idle`   | second row |

