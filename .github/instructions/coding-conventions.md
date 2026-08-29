---
description: >-
  Strict software implementation standards and coding conventions applied project-wide.
---
# Universal Coding Conventions

All code generated or modified within this project must adhere strictly to the following rules, without exception.

## Decomposition
* Keep files focused and concise. If a file significantly exceeds 500 lines, consider decomposing it into smaller, more focused modules or components.
* If a function or method exceeds 50 lines (roughly what fits on a single screen), consider refactoring it into smaller, more focused functions to improve readability and maintainability.

## Structure
* **Upward Dependency Resolution**: Internal dependencies should point upward 
  within the file. A called function (the dependency) must be declared prior to 
  the function invoking it.

## Comments & Documentation
* Use comments to explain **why** something is done, not **what** is done, unless the code itself is not clear enough or obvious to explain what it does.
* Add `TODO` if code deserves some improvement to make it more clear, but it is not yet the time to do so.
* Add doc-strings to classes, methods, and functions to explain their purpose and usage.
  * Add input parameters and return values to doc-strings for non-trivial cases.
    * *Note:* Standard methods like Python's `__...__` methods (e.g. `__add__`) with standard input/output format can be considered trivial.
  * Describe the expected behavior in doc-strings, especially for edge cases and error handling.
  * Describe cases (input versus output) such that they can be used to infer risk-based unit tests for non-trivial scenarios. Do this mainly for pure transformative (class) functions. When trivial or equal, do not repeat those for the integrating method(s).
* End all comment sentences with a period. Use proper grammar and punctuation.
* Put all words that are meant as literal code terms between backticks to simplify global renaming. `True` and `False` are also code terms. Only apply backticks when clearly referring to a code term or identifier available in the context of the comment.
* For comments explaining shortly the purpose of a single line of code, put the comment on the same line after the code, separated by at least two spaces.
* For section headers use `--- Heading ---` style.

**Comment Don'ts:**
* Do not use a "we" style. Use a descriptive style about what the code does or is meant for.
* Do not add delta comments describing changes (e.g. "changed X into Y"). Describe what is currently there.
* Do not arbitrarily mix comment styles (e.g. `/*...*/` and `//`). Keep a consistent style across the whole project.
* Never remove `TODO` or `FIXME` comments. Relocate them to a relevant position if their surrounding code is removed.
* Do not add step numbers in comments. These break too easily when code is refactored.
* Do not add a trailing `.` after section headers.

**Language-Specific Comment Rules:**
* **JavaScript/TypeScript:** 
  * Use `/** ... */` for JSDoc doc-strings of outer definitions in a file. 
  * Use `//` for all other cases, including inline comments.
* **Python:**
  * For single-line doc-strings (e.g. trivial property methods), put a space after the opening `"""` and before the closing `"""`.
  * For multi-line doc-strings, put the text after the opening `"""` on a new line, and the closing `"""` on a new line. Use `Google` style with sections like `Args`, `Returns`, `Raises`, etc. as needed.

## Messages
* Use backticks around values as part of messages (logs, exceptions, etc., e.g. to show actual/expected values in error messages).

## Identifier Names
* Never use abbreviated names, e.g. `prod` for `product` or `p` as a loop variable. Always use the full name for consistency and clarity. This includes specialization: use `newProduct` instead of `newProd`.
  * *Exceptions:* commonly accepted abbreviations: `id`, `dir`, `min`, `max`, `tmp`, `cfg`.
* In iterators, use the full descriptive name for the loop variable, not a single character. For example: `items.map(item => ...)` not `items.map(i => ...)`.

## Imports
* Put all imports at the top of the file. No inline imports.
* Never use wildcard (`*`) imports.

## Strings
* When strings can be specified with either single or double quotes, use double quotes consistently.

## Coding Style
* **JavaScript/TypeScript:**
  * Do not use `;` at the end of lines.
  * Use `camelCase` for variables and functions, `PascalCase` for classes and interfaces.
* **Python:**
  * Use standard Python naming conventions: `snake_case` for variables and functions, `PascalCase` for classes.

## File Rename and Move
* Always use `git mv` to rename or move files to preserve version history.

## Documentation
* Add an `index.md` file in every directory, per the `Directory Index Maintainer` agent.
  * Explain the purpose and scope of the directory.
  * List all files and subdirectories with a one-line description and relative links.
  * For component directories, include an introduction to the UI concept.

## Specifications
* In requirements specs write in plain English only. No code terms.
* Keep requirement specs limited to requirements. No design choices or implementation details.

## Line Length
* Keep Markdown files at a maximum of `80` characters per line.
* Keep code files at a maximum of `120` characters per line.