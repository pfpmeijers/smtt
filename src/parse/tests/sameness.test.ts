/**
 * Tests for the sameness operator `as` in a condition.
 *
 * Covers:
 *  - `as` naming another attribute, parsed as a reference binding.
 *  - `as` followed by a literal, rejected by the grammar.
 */

import { describe, it } from "node:test"
import * as assert from "node:assert/strict"

import { parseSource } from "../parse"

/** Wraps a single `States` cell in the minimum surrounding machine the grammar requires. */
function machineWithStatesCell(statesCell: string): string {
    return [
        "# M1",
        "",
        "## States",
        "",
        "- `S1`: The only state.",
        "",
        "## Transitions",
        "",
        "### Rules",
        "",
        "| States | Trigger | Result |",
        "|--------|---------|--------|",
        `| ${statesCell} | \`E1\` | \`S1\` |`,
        "",
    ].join("\n")
}

describe("Sameness (`as`)", () => {
    it("[TST-267] → [REQ-432]: parses `as` naming another attribute as a reference binding", () => {
        const stateMachine = parseSource(machineWithStatesCell("`S1` with `a1` as `a2`"))

        assert.deepStrictEqual(stateMachine.transitions![0].states[0].arguments, [
            { qualifier: "with", name: "a1", condition: { operator: "as", value: "a2", valueIsReference: true } },
        ])
    })

    it("[TST-268] → [REQ-432]: rejects `as` followed by a quoted literal", () => {
        assert.throws(() => parseSource(machineWithStatesCell("`S1` with `a1` as \"v1\"")))
    })

    it("[TST-269] → [REQ-432]: rejects `as` followed by a numeric literal", () => {
        assert.throws(() => parseSource(machineWithStatesCell("`S1` with `a1` as 1")))
    })

    it("[TST-270] → [REQ-432]: rejects `as` followed by a literal in a state's implied condition", () => {
        assert.throws(() => parseSource([
            "# M1",
            "",
            "## States",
            "",
            "- `S1`: The only state.",
            "  - `a1` as \"v1\"",
            "",
            "## Transitions",
            "",
            "### Rules",
            "",
            "| States | Trigger | Result |",
            "|--------|---------|--------|",
            "| `S1`   | `E1`    | `S1`   |",
            "",
        ].join("\n")))
    })
})
