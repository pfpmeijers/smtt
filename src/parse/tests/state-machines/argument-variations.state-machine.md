# Argument variations

Exercises data reference modifiers and value conditions recognized by the 
parser. 

## States

- `Phase one`: Initial phase with no data.
- `Phase two`: Phase with data and various transitions.
- `Phase three`: Final phase reached through various conditions and modifiers.

Initial state: `Phase one`

## Data

- `Count`: Number of items.
- `Label`: Display label.
- `Score`: Numeric score.
  ... extra description ...

Example values: 

| `Count` | `Label` | `Score` |
|---------|---------|---------|
| 2       | `alpha` | 10      |
| 0       | `beta`  | 20      |
| 1       | `beta`  | 20      |
| 3       | `beta`  | 20      |
| 5       | `beta`  | 20      |

## Transitions

### Default preconditions

- `Idle`

### Rules

| States                                            | Trigger                        | Result                               | Notes                            |
|---------------------------------------------------|--------------------------------|--------------------------------------|----------------------------------|
| `Phase one`                                       | `Started` for `Label`          | `Phase two` for `Label`              | Plain data ref                   |
| `Phase two` as `Label`                            | `Renamed` to different `Label` | `Phase two` as `Label`               | Negation: different              |
| `Phase two` as `Label`                            | `Swapped` with other `Label`   | `Phase two` as `Label`               | Negation: not                    |
| `Phase two` as `Label`                            | `Replaced` by unequal `Label`  | `Phase two` as `Label`               | Negation: unequal                |
| `Phase two` with `Count` = 0                      | `Item added`                   | `Phase two` with incremented `Count` | Eq condition + incremented       |
| `Phase two` with `Count` > 0                      | `Item removed`                 | `Phase two` with decremented `Count` | Gt condition + decremented       |
| `Phase two` with `Count` >= 3                     | `Threshold reached`            | `Phase three`                        | Ge condition                     |
| `Phase two` with `Count` <= 1                     | `Below minimum`                | `Phase one`                          | Le condition                     |
| `Phase two` with `Count` <> 0 and `Score` >= 10   | `Non-empty confirmed`          | `Phase two` with next `Score`        | Ne condition + next modifier     |
| `Phase two` with `Count` < 5 and `Score` = 10     | `Space available`              | `Phase two` with previous `Score`    | Lt condition + previous modifier |
| `Phase two` with `Count` in [1, 5]                | `Range validated`              | `Phase three`                        | Range condition                  |
| `Phase two` with `Label` in (`alpha`, `beta`)     | `Selected from set`            | `Phase three`                        | Set condition                    |
| `Phase two` with `Label` as `alpha`               | `Default confirmed`            | `Phase three`                        | Text equality: literal value     |
| `Phase two` with `Label` not as `alpha`           | `Custom confirmed`             | `Phase three`                        | Text inequality: literal value   |
| `Phase two` with `Count` not in [1, 5]            | `Out-of-range confirmed`       | `Phase three`                        | Not-in-range condition           |
| `Phase two` with `Label` not in (`alpha`, `beta`) | `Unlisted label confirmed`     | `Phase three`                        | Not-in-set condition             |
| `Phase three`                                     | `Reset`                        | `Phase one`                          | Simple reset                     |
