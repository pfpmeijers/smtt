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
| [`text.ts`](./text.ts) | Text rendering: `slugify`, `stateRefText`, `triggerText` and scenario label lower casing. |
| [`givens.ts`](./givens.ts) | Effective `Given` state resolution: default precondition injection, implied initial state and de-duplication. |
| [`expansion.ts`](./expansion.ts) | `expandStateTrigger()` — turns the sources resolved by `parse/expand.ts` into rendered paths: step texts and injected `Given` states. |
| [`conditions.ts`](./conditions.ts) | Implied-condition filters of a transition's effective `Given` states. |
| [`examples.ts`](./examples.ts) | Rendering of the `Examples:` block from the table the parse step resolves. |
| [`tests/`](./tests/) | Regression tests for the generated feature output. |
