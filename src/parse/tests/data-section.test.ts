/**
 * Tests for the `## Data` section's two spellings of its value rows.
 *
 * Covers:
 *  - A `### Value combinations` table, with and without a preceding attribute list.
 *  - A `### Values` list standing in for the table, with and without one.
 *  - The two spellings being mutually exclusive.
 */

import { describe, it } from "node:test"
import * as assert from "node:assert/strict"

import { parseSource } from "../parse"

/** Wraps a `## Data` section body in the minimum surrounding machine the grammar requires. */
function machineWithDataSection(dataSection: string): string {
    return [
        "# M1",
        "",
        "## States",
        "",
        "- `S1`: The only state.",
        "",
        "## Data",
        "",
        dataSection,
        "## Transitions",
        "",
        "### Rules",
        "",
        "| States | Trigger | Result |",
        "|--------|---------|--------|",
        "| `S1`   | `E1`    | `S1`   |",
        "",
    ].join("\n")
}

describe("## Data — value combinations table", () => {
    it("[TST-203] → [REQ-435]: reads the rows of a `### Value combinations` table", () => {
        const stateMachine = parseSource(machineWithDataSection([
            "- `a1`: First attribute.",
            "",
            "### Value combinations",
            "",
            "| `a1` | `a2` |",
            "|------|------|",
            "| \"x\"  | 1    |",
            "| \"y\"  | 2    |",
            "",
        ].join("\n")))

        assert.deepStrictEqual(stateMachine.dataValueCombinations, [{ a1: "x", a2: "1" }, { a1: "y", a2: "2" }])
        assert.equal(stateMachine.dataValues, undefined)
    })

    it("[TST-204] → [REQ-435]: reads a `### Value combinations` table with no attribute list before it", () => {
        const stateMachine = parseSource(machineWithDataSection([
            "### Value combinations",
            "",
            "| `a1` |",
            "|------|",
            "| \"x\"  |",
            "",
        ].join("\n")))

        assert.deepStrictEqual(stateMachine.dataValueCombinations, [{ a1: "x" }])
    })
})

describe("## Data — generated value combinations", () => {
    it("[TST-205] → [REQ-435]: records a `### Values` list as `dataValues`, rows left to the complete step", () => {
        const stateMachine = parseSource(machineWithDataSection([
            "- `a1`: First attribute.",
            "",
            "### Values",
            "",
            "- `a1`: \"x\", \"y\"",
            "- `a2`: 1, 2",
            "",
        ].join("\n")))

        assert.deepStrictEqual(stateMachine.dataValues, { a1: ["x", "y"], a2: ["1", "2"] })
        assert.deepStrictEqual(stateMachine.dataValueCombinations, [])
    })

    it("[TST-210] → [REQ-435]: reads `undefined` in a `### Values` list as the absent value", () => {
        const stateMachine = parseSource(machineWithDataSection([
            "### Values",
            "",
            "- `a1`: undefined, \"x\"",
            "",
        ].join("\n")))

        assert.deepStrictEqual(stateMachine.dataValues, { a1: ["", "x"] })
    })

    it("[TST-206] → [REQ-435]: declares an attribute named only by a `### Values` entry", () => {
        const stateMachine = parseSource(machineWithDataSection([
            "- `a1`: First attribute.",
            "",
            "### Values",
            "",
            "- `a1`: \"x\"",
            "- `a2`: \"y\"",
            "",
        ].join("\n")))

        assert.deepStrictEqual(stateMachine.data, { a1: "First attribute.", a2: "" })
    })

    it("[TST-207] → [REQ-435]: reads a `### Values` list with no attribute list before it", () => {
        const stateMachine = parseSource(machineWithDataSection([
            "### Values",
            "",
            "- `a1`: \"x\", \"y\"",
            "",
        ].join("\n")))

        assert.deepStrictEqual(stateMachine.dataValues, { a1: ["x", "y"] })
        assert.deepStrictEqual(stateMachine.data, { a1: "" })
    })

    it("[TST-208] → [REQ-435]: rejects `### Values` alongside a `### Value combinations` table", () => {
        assert.throws(
            () => parseSource(machineWithDataSection([
                "- `a1`: First attribute.",
                "",
                "### Values",
                "",
                "- `a1`: \"x\", \"y\"",
                "",
                "### Value combinations",
                "",
                "| `a1` |",
                "|------|",
                "| \"x\"  |",
                "",
            ].join("\n"))),
            /`### Values` and a `### Value combinations` table are alternatives, not a pair/,
        )
    })

    it("[TST-209] → [REQ-435]: rejects both spellings with no attribute list before them", () => {
        assert.throws(
            () => parseSource(machineWithDataSection([
                "### Values",
                "",
                "- `a1`: \"x\", \"y\"",
                "",
                "### Value combinations",
                "",
                "| `a1` |",
                "|------|",
                "| \"x\"  |",
                "",
            ].join("\n"))),
            /`### Values` and a `### Value combinations` table are alternatives, not a pair/,
        )
    })
})
