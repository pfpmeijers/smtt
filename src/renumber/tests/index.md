# Renumber tests

This directory contains regression tests for transition ID renumbering.

## Files

- [`renumber.test.ts`](./renumber.test.ts): Verifies transition ID insertion and replacement across multiple files with deterministic numbering.

## Directories

- [`state-machines/`](./state-machines/): Static fixture state machines used as test input; copied to `results/` before each run so originals stay unmodified.
- [`results/`](./results/): Renumbered copies of the fixture files, produced at test runtime.
