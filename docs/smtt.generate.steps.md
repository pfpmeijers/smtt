# SMTT Gherkin Step Definition Generation

> This document specifies the requirements for generating `.steps.js` files 
> from the parsed transition/state data, not from the raw `.feature` files. 
> The generator works from the data model represented by the AST and transition 
> records.

- [REQ-201] The generator shall write one `.steps.js` file per state machine or 
  feature.
- [REQ-202] The generated file shall be named `$feature-name.steps.js`.
- [REQ-203] The `$feature-name` shall be derived from the state machine name in 
  lower-case kebab-case, e.g. `page-navigation.steps.js`.
- [REQ-204] The generated file shall import `Given`, `When`, and `Then` 
  from `../utils`.
- [REQ-205] The generated file shall import the fixture bundle from 
  `../fixtures/index.js`.
- [REQ-206] The generated file shall contain three top-level sections in the 
  order `Given`, `When`, and `Then`.
- [REQ-207] Each section shall be headed with a comment of the form 
  `// --- $section ---`.
- [REQ-208] Within each section, step definitions shall be sorted 
  alphabetically by the rendered step pattern.
- [REQ-209] The generator shall register one Cucumber step definition per 
  unique step pattern and step keyword combination.
- [REQ-210] Repeated step patterns across multiple scenarios 
  (transitions) shall be deduplicated; the generator shall keep one 
  registration and record the originating transition IDs as comments.
- [REQ-211] The generator shall print transition IDs as a comma-separated 
  comment immediately above the generated step definition, 
  e.g. `// 021, 022, 023`.
- [REQ-212] The generator shall render the step pattern text with the correct
  keyword prefix for the step kind:
  - `Given` steps begin with `initially `
  - `When` steps use the trigger text verbatim
  - `Then` steps begin with `expect `
- [REQ-213] The generated step definitions shall follow the Cucumber 
  registration shape:

  ```js
  Given('initially landing page selected', async ({ page }) => {
    await fixtures.setLandingPageSelected({ page })
  })
  ```

- [REQ-214] When the step text contains arguments, the pattern shall include 
  `{string}` placeholders and the callback shall receive matching parameter 
  names.
- [REQ-215] Parameter names shall be derived from the example column names, 
  normalized to camelCase.
- [REQ-216] The callback signature for parameterized steps shall be 
  `async ({ page }, $param1, $param2, ...)`.
- [REQ-217] The generated fixture call shall pass the same parameter names to 
  the fixture function in the same order.
- [REQ-218] The generator shall derive the fixture function name from the
  rendered step phrase, excluding the keyword prefix and converting the remaining
  text to camelCase, then applying the keyword-specific action prefix used by the
  fixture conventions:
  - `initially landing page Selected` → `setLandingPageSelected`
  - `home selected` → `makeHomeSelected`
  - `expect landing page selected` → `expectLandingPageSelected`
- [REQ-219] The fixture name shall be derived from the step content, not from
  the original scenario title text.
- [REQ-220] The generator shall create separate `Given`, `When`, and `Then`
  step registrations even when the same semantic phrase appears in multiple
  transitions; it shall not emit `And` as a separate top-level registration in
  the generated JS file.
- [REQ-221] For state-machine transitions, the generator shall emit a `Given`
  step for each relevant precondition state and a `Then` step for the resulting
  state.
- [REQ-222] For trigger events, the generator shall emit a `When` step from the
  trigger text.
- [REQ-223] For a state-trigger transition that expands into multiple paths, the
  generator shall emit one `When` step per expanded trigger variant and one
  intermediate `Then` step for the directly-entered state when required by the
  expansion rules.
- [REQ-224] The generator shall preserve the ordering rules for precondition
  states:
  - default preconditions first
  - explicit transition states afterward
  - within each group, original array order shall be preserved
- [REQ-225] The generator shall use the same normalized scenario data that is
  written to the feature files as the source for step generation.
- [REQ-226] The generator shall emit only step entries that belong to the state 
  machine whose steps file is being generated.
- [REQ-227] The generator shall emit a trailing newline at the end of each
  generated `.steps.js` file.
- [REQ-228] The generator shall be deterministic: equivalent input data shall
  produce the same step file content, regardless of scenario ordering.

## Shared triggers

Two different state machines may legitimately react to the same real-world
event, so the same trigger name can appear as a `When` step in more than one
state machine's transitions. Writing that step definition into every
contributing state machine's file would register the same step pattern more
than once across files, which the target step runner rejects.

- [REQ-229] The generator shall determine, across all state machines, which
  rendered `When` step pattern and keyword combinations occur in more than
  one state machine. This applies regardless of whether the pattern comes
  from a direct event trigger or from a resolved state-trigger expansion
  (see [State Trigger Expansion](#state-trigger-expansion)).
- [REQ-230] A `When` step pattern used by exactly one state machine shall
  remain in that state machine's own `.steps.js` file, unaffected by this
  section (REQ-226).
- [REQ-231] A `When` step pattern used by two or more state machines shall be
  written once, into a shared step file, instead of being duplicated into
  each contributing state machine's file.
- [REQ-232] The shared step file shall be named `shared.steps.js`.
- [REQ-233] The shared step file shall follow the same structure as a
  per-state-machine step file (REQ-204 up to REQ-217), restricted to a
  single `When` section. `Given` and `Then` steps always belong to exactly
  one state machine, because state names are unique across all state
  machines, so they are never subject to sharing.
- [REQ-234] When the contributing state machines register the same pattern
  with different parameter lists, the shared step definition shall use the
  widest parameter list encountered, following the same rule as for
  duplicate patterns within one file (REQ-210).
- [REQ-235] The transition-id comment above a shared step definition
  (REQ-211) shall list the deduplicated, sorted transition ids contributed
  by every state machine that uses the pattern.
- [REQ-236] The assignment of a `When` step pattern to the shared file,
  versus to a single state machine's own file, shall be deterministic and
  independent of state machine or transition ordering (REQ-228).

## Example shape

```js7
import { Given, When, Then } from '../utils'
import * as fixtures from '../fixtures/index.js'

// --- Given ---

// 021, 022, 023
Given('initially landing page selected', async ({ page }) => {
  await fixtures.setLandingPageSelected({ page })
})

// --- When ---

// 021
When('subsite selected', async ({ page }) => {
  await fixtures.makeSubsiteSelected({ page })
})

// --- Then ---

// 021, 039
Then('expect subsite page with {string}', async ({ page }, subject) => {
  await fixtures.expectSubsitePage({ page }, subject)
})
```
