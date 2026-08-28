// Preamble developer comment.
// Another preamble comment.

# Comments machine

// Developer comment before states section.

// Multi-line comment 
// that continues on the next line.

## States

- `Idling`: The machine is idling. // Developer comment about idle.
- `Active`: The machine is active. // Developer comment about active.

Initial state: `Idling` // Developer comment about initial state.

## Data

- `count` // Developer comment about count.

Example values:

| `count`                |
|------------------------|
| 0 // initial count     |
| 1 // incremented count |

// Developer comment before transitions section.
## Transitions

### Rules

| States                             | Trigger                            | Result                             | Notes                            |
|------------------------------------|------------------------------------|------------------------------------|----------------------------------|
| `Idling` // comment in states cell | `Start` // comment in trigger cell | `Active` // comment in result cell | started // comment in notes cell |
| `Active`                           | `Stop`                             | `Idling`                           | stopped                          |
