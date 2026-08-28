# Playbook: SMTT Generate Feature Test Review

## Trigger

The user asks to run, verify, or review a specific test case (`TST-NNN`) 
from the **`generate` module's Gherkin feature-file generator**
suite, under `tests/smtt/src/generate/tests/`, against the
`smtt.generate.features.md` specification.

Scope note: this covers only `tests/smtt/src/generate/` feature-file
generation from a state-machine AST. It does not apply to `smtt`'s other
modules (`parse/`, `analyze/`, `infer/`, `renumber/`) or to the
`generate` module's other functionality (like creating steps and fixtures 
files).

## Prerequisite

- `tests/smtt/docs/smtt.generate.features.md` (the requirements spec).
- The test harness in `tests/smtt/src/generate/tests/utils/`

## Execution Steps

**1. Scope**
- Identify the exact single `TST-NNN` id requested, and the `.test.ts` file
  that contains it. Do not widen scope to the rest of that file or to the
  full test suite. If more than one `TST-NNN` was requested, review only the
  first and tell the user the rest must be reviewed one at a time.

**2. Run**
- From `tests/smtt/`, run:
  `npx tsx --test --test-name-pattern="TST-NNN" src/generate/tests/<file>.test.ts`
  substituting the exact `TST-NNN` id. Never omit `--test-name-pattern`.

**3. Inspect the Assertions**
- Check every assertion call in the test case with its literal arguments.
- Flag any that could pass vacuously.

**4. Read the Result and Requirements**
- Open `tests/smtt/src/generate/tests/results/<NNN>.feature` and extract
  its `# State machines:` YAML block and `# Covers requirements:`
  `[REQ-...]` list.
- Look up each listed `[REQ-...]`'s exact wording in
  `smtt.generate.features.md`. 

**5. Derive and Compare**
- From the state machines and requirements, manually derive the expected
  `Scenario:`/`Scenario Outline:` content: label (own state, result,
  trigger, context states), `Given` order (default/injected/explicit
  states), `When`/intermediate `Then` steps for expansion, and any
  `Examples:` table.
- Diff this expectation against the actual result content.

**6. Report and Halt**
Summarize, then stop — do not edit `features.ts`, the test, or any
reference/result file unless explicitly instructed to. Keep the first three
sections condensed to short one-line checkpoints (✅/⚠️/❌ + a few words) —
no paragraphs, no verbose explanations:
- **Requirements coverage**: one line per `[REQ-...]` — confirmed / not
  demonstrated / ambiguous.
- **Assertion quality**: one line per weak or vacuous assert (or "none
  found"), naming the assert and the one-word reason.
- **Result vs. spec**: one line per discrepancy, quoting only the
  mismatched fragment — no surrounding narrative.
- **Recommendation** (pick one, propose only): create the missing
  reference from the verified-correct result; update the stale reference;
  fix the test's asserts/fixtures; fix `features.ts` (name the function);
  or ask the user when the spec is ambiguous.
