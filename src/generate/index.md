# `generate/` — SMTT Generate Command

Implements the `generate` subcommand of `smtt.ts`.
Reads the parsed and inferred state machine JSON (produced by the `parse` and
`infer` pipeline) and writes **Gherkin feature files** (`features/`), step
definitions (`steps/`) and fixture stubs (`fixtures/`) — one file per state
machine in each output directory, plus a shared step/fixture file for trigger
patterns used by more than one state machine.

## Files

| File | Description |
|------|-------------|
| [`generate.ts`](./generate.ts) | Entry point of the `generate` subcommand; loads the AST and writes features, steps and fixtures. |
| [`features.ts`](./features.ts) | `renderFeatures()` / `writeFeatureFiles()` — orchestrates scenario, step and examples rendering per state machine. |
| [`steps.ts`](./steps.ts) | `renderStepFiles()` / `writeStepFiles()` — generates one `.steps.js` file per state machine, plus `shared.steps.js` for `When` patterns shared across state machines. |
| [`fixtures.ts`](./fixtures.ts) | `renderFixtureFiles()` / `writeFixtureFiles()` — generates one `.fixtures.js` file per state machine, `shared.fixtures.js` for shared `When` fixtures, plus `fixtures/index.js`. |
| [`sharing.ts`](./sharing.ts) | `collectSharedTriggerSteps()` / `ownSteps()` — determines which `When` step patterns are registered by more than one state machine, for the shared step/fixture files. |
| [`arguments.ts`](./arguments.ts) | Argument level helpers: canonical modifiers, derived column names, placeholder names and validation. |
| [`text.ts`](./text.ts) | Text rendering: `slugify`, `stateRefText`, `triggerText` and scenario label lower casing. |
| [`ownership.ts`](./ownership.ts) | State ownership index (state name → declaring machine) and implied conditions index. |
| [`givens.ts`](./givens.ts) | Effective `Given` state resolution: default precondition injection, implied initial state and de-duplication. |
| [`expansion.ts`](./expansion.ts) | `expandStateTrigger()` — resolves state triggers to event trigger paths; chain analysis helpers. |
| [`conditions.ts`](./conditions.ts) | Condition validation, evaluation and collection of example row filters. |
| [`examples.ts`](./examples.ts) | Examples table construction: value table merging, column derivation, row filtering and formatting. |
| [`tests/`](./tests/) | Regression tests for the generated feature output. |
