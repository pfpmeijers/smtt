# m1

A state implying a state of another machine, which itself implies a state of a
third machine.

## States

- `s1`: Implies a state of m2, and holds a value.
  - `s3` // m2 state
  - `a1` defined
- `s2`

## Transitions

### Rules

| States | Trigger | Result |
|--------|---------|--------|
| `s1`   | `e1`    | `s2`   |
