# Condition reference

Exercises attribute-reference condition values on a result argument: a
backticked value names another attribute, dynamically resolved per row,
instead of being a quoted literal.

## States

- `Painting listed`: The painting has a list price but no sale price yet.
- `Painting sold`: The painting has been sold.

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

### Rules

| States                              | Trigger          | Result                                                                    |
|-------------------------------------|------------------|---------------------------------------------------------------------------|
| `Painting listed` with `list price` | `Sale confirmed` | `Painting sold` with `sale price` = `list price` and `note` as "archived" |
