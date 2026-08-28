# infer

Closed-world impossibility inference for state machine AST data.

Reads the `state-machines.json` produced by the `parse` step and derives
impossible trigger/state combinations that are not explicitly declared in the
source files. Results are written into `impossible.inferred` alongside the
existing `impossible.defined` entries.

## Files

| File                                       | Description                                                                                                                                                          |
|--------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| [impossibilities.ts](./impossibilities.ts) | Core algorithm: computes inferred `ImpossibleTrigger` entries for each state machine using a two-pass closed-world approach.                                         |
| [infer.ts](./infer.ts)                     | Inferrer entrypoint: exports `infer(jsonPath)`, which loads state machines from JSON, writes inferred entries to `impossible.inferred`, and saves the file in place. |

