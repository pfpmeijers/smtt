# SMTT Fixture Generation

> This document specifies the requirements for generating `.fixtures.js` files
> and the shared `fixtures/index.js` re-export file from the normalized
> transition/state data.

- [REQ-301] The generator shall write one `.fixtures.js` file per state machine.
- [REQ-302] The generated file shall be named `$state-machine.fixtures.js`.
- [REQ-303] The `$state-machine` shall be derived from the state machine name in
  lower-case kebab-case, e.g. `page-navigation.fixtures.js`.
- [REQ-304] The generator shall write a `fixtures/index.js` file that re-exports
  all generated fixture files.
- [REQ-305] The generator shall use the same normalized scenario data that is
  written to the feature files as input for fixture generation.
- [REQ-306] The generated fixture file shall contain three top-level sections in
  the order `Given`, `When`, and `Then`.
- [REQ-307] Each section shall be headed with a comment of the form
  `// --- $section ---`, where `$section` is one of `Set (Given)`, `Make (When)`
  or `Expect (Then)`.
- [REQ-308] Within each section, fixture stubs shall be sorted alphabetically by
  the rendered fixture function name.
- [REQ-309] The generator shall register one fixture stub per unique fixture
  function name within a state machine.
- [REQ-310] When multiple transitions produce the same fixture function name,
  the generator shall keep a single stub and use the widest parameter list it
  encountered.
- [REQ-311] The generator shall render fixture function names from the generated
  step phrase, excluding the keyword prefix, and then applying the keyword
  prefix used by the fixture convention:
  - `Given` steps begin with `set`
  - `When` steps begin with `make`
  - `Then` steps begin with `expect`
- [REQ-312] The generated fixture function shall follow the shape:

  ```js
  export async function setLandingPageSelected({ page }) {
    // TODO: Implement.
    console.log("NOT IMPLEMENTED: setLandingPageSelected")
  }
  ```

- [REQ-313] When the fixture phrase contains arguments, the function signature
  shall include matching camelCase parameter names after `{ page }`.
- [REQ-314] Parameter names shall be derived from the rendered step placeholders
  and normalized to camelCase.
- [REQ-315] The generator shall emit only fixture stubs that belong to the state
  machine whose fixture file is being generated.
- [REQ-316] The generator shall emit a trailing newline at the end of each
  generated `.fixtures.js` and `fixtures/index.js` file.
- [REQ-317] The generator shall be deterministic: equivalent input data shall
  produce the same fixture file content regardless of transition ordering.

## Example shape

```js
// page navigation fixtures.
// Implement each function to interact with the application under test.

// --- Set (Given) ---

export async function setLandingPageSelected({ page }) {
    // TODO: Implement.
    console.log("NOT IMPLEMENTED: setLandingPageSelected")
}

// --- Make (When) ---

export async function makeSubsiteSelected({ page }) {
    // TODO: Implement.
    console.log("NOT IMPLEMENTED: makeSubsiteSelected")
}

// --- Expect (Then) ---

export async function expectSubsitePage({ page }, subject) {
    // TODO: Implement.
    console.log("NOT IMPLEMENTED: expectSubsitePage")
}
```
