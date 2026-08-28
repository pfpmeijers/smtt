# Session

## States

- `session active`
- `user authenticated`

## Transitions

### Rules

| States               | Trigger | Result           |
|----------------------|---------|------------------|
| `session active`     | `Start` | `session active` |
| `user authenticated` | `Start` | `session active` |
