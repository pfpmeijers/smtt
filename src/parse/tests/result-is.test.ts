/**
 * Tests for `is`/`are` as a synonym of `set to` in a transition result.
 *
 * Covers:
 *  - `is` / `are` followed by a literal or `undefined`, parsed as a result value.
 *  - `is` followed by a reference, or `is not`, left to the suffix and rejected (REQ-443).
 */

import { describe, it } from "node:test"
import * as assert from "node:assert/strict"

import { parseSource } from "../parse"
import { validateResultArgumentSuffixes } from "../validate"

/** Wraps a single `Result` cell in the minimum surrounding machine the grammar requires. */
function machineWithResultCell(resultCell: string): string {
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
        `| \`S1\` | \`E1\` | ${resultCell} |`,
        "",
    ].join("\n")
}

describe("Result value written with `is`", () => {
    it("[TST-272] → [REQ-415]: parses `is` followed by a quoted literal like `set to`", () => {
        const withIs = parseSource(machineWithResultCell("`S1` with `a1` is \"v1\""))
        const withSetTo = parseSource(machineWithResultCell("`S1` with `a1` set to \"v1\""))

        assert.deepStrictEqual(withIs.transitions![0].result, withSetTo.transitions![0].result)
        assert.deepStrictEqual(withIs.transitions![0].result.arguments, [
            { qualifier: "with", name: "a1", result: { value: "v1" } },
        ])
    })

    it("[TST-273] → [REQ-415]: parses `are` followed by a numeric literal, and `is undefined`", () => {
        const stateMachine = parseSource(machineWithResultCell("`S1` with `a1` are 2 and `a2` is undefined"))

        assert.deepStrictEqual(stateMachine.transitions![0].result.arguments, [
            { qualifier: "with", name: "a1", result: { value: "2" } },
            { name: "a2", result: {} },
        ])
    })

    it("[TST-274] → [REQ-443]: `is` followed by a reference, or `is not`, stays a rejected suffix", () => {
        for (const resultCell of ["`S1` with `a1` is `a2`", "`S1` with `a1` is not \"v1\""]) {
            const stateMachine = parseSource(machineWithResultCell(resultCell))
            assert.throws(() => validateResultArgumentSuffixes([stateMachine]), /REQ-443/)
        }
    })
})
