# Condition reference

Exercises attribute references on both sides they are supported: a result
argument's result value, and a condition on a state or trigger argument. A
backticked value names another attribute, dynamically resolved per row,
instead of being a quoted literal. Every site that accepts a condition is
covered — state implied condition, default precondition, `States` cell and
`Trigger` cell — as is each operator spelling that carries a reference.

## States

- `Painting listed`: The painting has a list price but no sale price yet.
- `Painting sold`: The painting has been sold.
  - `sale price` as `list price`
- `Painting offered`: A buyer has bid on the painting.

Initial state: `Painting listed`

## Data

- `list price`: The painting's asking price.
- `note`: Free-text annotation, unrelated to any attribute name.

Example values:

| `list price` | `note`    |
|--------------|-----------|
| 10           | "default" |
| 20           | "default" |

## Transitions

### Default preconditions

- `User authenticated` with `quoted price` is `list price`: The price quoted
  to the buyer is the asking price.

### Rules

| States                                                | Trigger                                 | Result                                                                             |
|-------------------------------------------------------|-----------------------------------------|------------------------------------------------------------------------------------|
| `Painting listed` with `list price`                   | `Sale confirmed`                        | `Painting sold` with `sale price` set to `list price` and `note` set to "archived" |
| `Painting listed` with `list price`                   | `Bid placed` with `bid` as `list price` | `Painting offered`                                                                 |
| `Painting listed` with `reserve price` = `list price` | `Reserve met`                           | `Painting offered`                                                                 |
| `Painting offered` with `bid` <> `list price`         | `Bid withdrawn`                         | `Painting listed`                                                                  |
