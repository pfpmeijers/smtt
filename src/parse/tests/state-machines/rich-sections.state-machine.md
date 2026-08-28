// This file exercises data and transition detail variants.

# Rich sections machine

This state machine validates dependency entries, data examples, and table-based
transition constraints.

## States

- `Awaiting payment`: Waiting for user confirmation.
- `Verified user`: User identity was verified.
- `Reserved stock`: Inventory was tentatively reserved.
- `Completed`: The process is finished.

Initial state: `Awaiting payment`

## Data

- `Customer ID`: Stable customer identifier.
- `Quantity`: Ordered amount.
- `Tier`: Customer level.

Example values:

| `Customer ID` | `Quantity` | `Tier`   |
|---------------|------------|----------|
| `A-42`        | 5          | `gold`   |
| `B-21`        | 9          | `silver` |
| `C-11`        | 1          | `bronze` |

## Transitions

### Default preconditions

- `Idling`
- `User authenticated`

### Rules

| States                                                                 | Trigger                              | Result                                                 | Notes                              |
|------------------------------------------------------------------------|--------------------------------------|--------------------------------------------------------|------------------------------------|
| `Awaiting payment`                                                     | `Reserve` for `Customer ID`          | `Reserved stock` for `Customer ID`                     | Event with argument parsing.       |
| `Reserved stock` with `Quantity` in [1, 10] and `Customer ID` = `B-21` | `Confirmation` by next `Customer ID` | `Completed`                                            | Range condition and modifier.      |
| `Reserved stock` for `tier` not in (`gold`, `silver`)`                 | `Reject`                             | `Awaiting payment`                                     | Set-negation condition.            |
| `Reserved stock`                                                       | `Confirmation` of `Quantity` = 1     | `Reserved stock` with incremented `Quantity` of 1 unit | Argument suffix text is preserved. |

### Impossible

| States                            | Trigger                   |
|-----------------------------------|---------------------------|
| `Awaiting payment`                | `Pay` with `Quantity` < 0 |
| `Reserved stock`, `Verified user` | `Drop` for `customer ID`  |

### Irrelevant

| States      | Trigger        |
|-------------|----------------|
| `Completed` | `Ping`         |
| `Completed` | `Check status` |

### Notes

Transition blocks include both impossible and irrelevant tables.
