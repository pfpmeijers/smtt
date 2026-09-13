# `parse/` — SMTT Parse Step

Turns `*.state-machine.md` sources into the state-machine AST: grammar, AST
construction, completion of implicit data semantics, and validation.

The parse step is application independent. It produces a semantic data
structure for a set of state machines — states, transitions, triggers, data
attributes and their example values — and states what that structure means,
never what a consumer (feature files, test steps, fixtures) needs from it.

Specifications: [`smtt.parse.validate.md`](../../docs/smtt.parse.validate.md)
for the constraints an AST shall satisfy,
[`smtt.parse.complete.md`](../../docs/smtt.parse.complete.md) for what
completion adds, and [`sm.spec.md`](../../docs/sm.spec.md) for the authoring
notation.

## Files

| File | Description |
|------|-------------|
| [`parse.ts`](./parse.ts) | Entry point: reads the source files, runs the grammar, classifies triggers, completes and validates the AST. |
| [`sm.ohm`](./sm.ohm) | The Ohm grammar of the `*.state-machine.md` notation. |
| [`sm.ast.ts`](./sm.ast.ts) | Semantic actions building the AST from a grammar match, plus AST file I/O. |
| [`sm.ast.schema.json`](./sm.ast.schema.json) | JSON Schema of the AST — the contract every consumer reads. |
| [`sm.ast.d.ts`](./sm.ast.d.ts) | TypeScript types generated from the schema by `update-schemas.cjs`. |
| [`complete.ts`](./complete.ts) | Completion: infers data attributes from usage and fills in the example value rows those usages imply. |
| [`validate.ts`](./validate.ts) | Schema and business-rule validation of the raw and the complete AST. |
| [`ownership.ts`](./ownership.ts) | State ownership lookup: which machine declares a given state name. |
| [`modifiers.ts`](./modifiers.ts) | Modifier canonicalization: which spellings denote the same modifier. |
| [`conditions.ts`](./conditions.ts) | Condition evaluation and the row filters a transition's conditions impose. |
| [`arguments.ts`](./arguments.ts) | Argument semantics: the name a value goes by, the signature two references share, and argument validity. |
| [`examples.ts`](./examples.ts) | Example values of a transition: the merged table of every machine taking part in its context, the columns it holds, and the rows surviving its conditions. |
| [`expand.ts`](./expand.ts) | State-trigger resolution: which transitions can causally explain a state trigger, which machines take part in a transition's context, and the annotation recording that resolution on the AST. |
| [`transitions.ts`](./transitions.ts) | The `transitions.txt` report: how each transition resolves, with its preconditions, trigger and surviving example rows. |
| [`update-schemas.cjs`](./update-schemas.cjs) | Regenerates `sm.ast.d.ts` from the schema. |
| [`index.ts`](./index.ts) | Public surface of the parse step, re-exporting the modules above. |
| [`tests/`](./tests/) | Parser snapshot tests plus completion and validation unit tests. |
