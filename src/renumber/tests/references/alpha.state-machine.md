# Alpha machine

## States
- `Idle`
- `Active`

## Transitions

### Rules
| # | States | Trigger | Result | Notes |
| --- | --- | --- | --- | --- |
| 001 | `Idle` | `Start` | `Active` | first row |
| 002 | `Active` | `Stop` | `Idle` | second row |

