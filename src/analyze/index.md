# analyze

Static analysis and reachability reporting for state machines.

Performs backward-chaining dependency tracing, breadth-first search state-space
exploration, dead-transition detection, missing-variant identification, and
Markdown analysis report generation.

## Files

| File | Description |
|---|---|
| [analyze.ts](./analyze.ts) | Main orchestrator: exports `analyzeStateMachines` and `analyze`. |
| [explore.ts](./explore.ts) | Breadth-first search state-space exploration and reactor firing. |
| [index.ts](./index.ts) | Public module exports for the analyzer package. |
| [insights.ts](./insights.ts) | Constraint diagnostics, predecessor coverage, and cycle checks. |
| [normalize.ts](./normalize.ts) | State indexing, transition classification, and dependency trees. |
| [report.ts](./report.ts) | Structured report formatting and Markdown rendering. |
| [types.ts](./types.ts) | TypeScript interfaces and type definitions for the analyzer. |
