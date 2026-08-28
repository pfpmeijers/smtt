# Device

Exercises cross-machine impossibility inference dependent on Mode.
Trigger "Start triggered" is only handled when Mode is active and Device is ready,
so Mode inactive and Device busy are each inferred impossible for it.
Trigger "Done triggered" is handled only for Device busy with no Mode precondition,
so Mode active, Mode inactive, and Device ready are each inferred impossible for it.

## States
- `Device ready`: Device is ready to start processing.
- `Device busy`: Device is currently processing.

Initial state: `Device ready`

## Data
None

## Transitions

### Rules

| States                        | Trigger           | Result         | Notes |
|-------------------------------|-------------------|----------------|-------|
| `Mode active`, `Device ready` | `Start triggered` | `Device busy`  |       |
| `Device busy`                 | `Done triggered`  | `Device ready` |       |
