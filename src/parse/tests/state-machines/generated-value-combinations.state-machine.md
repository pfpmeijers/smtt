# Generated value combinations

Exercises the generated spelling of the data section: rather than pairing values
into rows by hand in a combinations table, the source lists the values each
attribute may take, which stands for every combination of them. The parser
records the lists as-is; deriving the rows is the complete step's job.

## States

- `Article drafted`: The document is being edited.
- `Article published`: The document is visible to readers.

Initial state: `Article drafted`

## Data

- `language`: The language the document is written in.
- `revision`: The document's revision number.

### Values

- `language`: "en", "nl", "de"
- `revision`: 1, 2

## Transitions

### Rules

| States                                        | Trigger                     | Result                  |
|-----------------------------------------------|-----------------------------|-------------------------|
| `Article drafted` with `language` and `revision`        | `Publish requested`         | `Article published`             |
| `Article published` with `language` is "nl"           | `Withdrawal requested`      | `Article drafted`                 |
