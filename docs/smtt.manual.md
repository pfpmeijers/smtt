# SMTT usage manual

This document collects practical usage guidance for authors writing
`*.state-machine.md` files — decisions that are legal and well-defined
according to the formalism, but where the *consequences* for test coverage
are easy to miss. It is not a specification:

- For the state-machine authoring syntax, see [sm.spec.md](sm.spec.md).
- For the formal, REQ-numbered generator behavior, see the other
  `smtt.*.md` documents in this folder.

Each entry below states the situation, the choice available to the author,
and the trade-off between the options.

---

## 1. Bare state reference vs. `with <attribute>`: don't-care collapsing

**Situation.** A state can declare an implied data condition, e.g.:

```markdown
## States
- `Cart empty`
  - `Painting count` = 0
- `Cart non-empty`
  - `Painting count` > 0
```

A transition can reference `Cart non-empty` as a precondition in two ways:

- bare — `Cart non-empty`
- with the attribute named — `Cart non-empty with Painting count`

Both are valid and both apply the implied condition (`Painting count > 0`)
as a row filter. But only the second makes `Painting count` an example-table
*column* in the scenario definition. Implied conditions only ever filter rows; 
on their own they never add a column or turn a plain `Scenario` into a 
`Scenario Outline` (see REQ-167 in `smtt.generate.features.md`). 
Referencing the attribute is what promotes it to a column (REQ-064).

**Consequence.** For a bare reference, every value that survives the
implied-condition filter (e.g. `Painting count` = 1 and = 2, both `> 0`)
produces a row that is identical in every *rendered* column, since the
attribute itself isn't shown. Row de-duplication then collapses them into
one representative scenario. When the state is referenced with the attribute, 
each surviving value gets its own column value and its own row (subject to the
usual de-duplication).

**The decision to make.** Ask: does this rule's *outcome* actually depend
on the specific value, or only on which side of the implied condition it
falls on?

- **Outcome is value-independent** (e.g. the cart ends up empty whether it
  held 1 or 2 paintings) — leave the reference bare. The collapse to one
  representative row is intentional test economy: additional rows would
  just re-exercise the same code path with no new information.
- **You want explicit proof of value-independence**, or you're not
  confident the outcome really is value-independent (e.g. an off-by-one
  bug could plausibly clear "count − 1" instead of clearing to zero) —
  reference the attribute explicitly (`with Painting count`). This turns
  the don't-care into a proven property: each value becomes its own
  scenario row, at the cost of extra scenario variants that (if the code is
  correct) will have duplicate outcomes.

There is no automatic middle ground: the generator does not infer whether a
value "matters" — the state-machine source is the single place this
decision is recorded, per attribute, per transition.
