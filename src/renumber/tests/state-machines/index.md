# State machine test fixtures for renumber tests

Contains static state machine files used as input for renumber regression tests.
Each file is copied to `../results/` before a test run; the originals are never modified.

## Files

- [`alpha.state-machine.md`](./alpha.state-machine.md): A two-transition state machine with no 
  existing `#` column, used to verify column insertion.
- [`beta.state-machine.md`](./beta.state-machine.md): A one-transition state machine with a 
  stale `#`column, used to verify ID replacement.

