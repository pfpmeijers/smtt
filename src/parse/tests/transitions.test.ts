/**
 * Tests for the transition report (`transitions.ts`).
 *
 * Covers:
 *  - The results a fully expanded transition lists, one per transition along its chain.
 *  - The example columns it shows, matching the generated scenario.
 */

import { describe, it } from "node:test"
import * as assert from "node:assert/strict"

import type { StateMachine } from "../sm.ast.d"
import { renderTransitionsReport } from "../transitions"

/**
 * Three machines chained by state triggers: `m1` sets `a` on event `e`, `m2` sets `x` from the
 * `a` it is triggered with, and `m3` sets `y` from the `x` it is triggered with.
 */
function buildChainedMachines(): StateMachine[] {
    return [
        {
            name: "m1",
            states: [{ name: "s1" }, { name: "s2" }],
            dataValueCombinations: [{ b: "5" }],
            transitions: [{
                id: "1",
                states: [{ name: "s1" }],
                trigger: { type: "event", name: "e", arguments: [{ name: "b" }] },
                result: { name: "s2", arguments: [{ name: "a", result: { value: "b", valueIsReference: true } }] },
            }],
        },
        {
            name: "m2",
            states: [{ name: "s3" }, { name: "s4" }],
            dataValueCombinations: [{ z: "9" }],
            transitions: [{
                id: "2",
                states: [{ name: "s3", arguments: [{ name: "z" }] }],
                trigger: { type: "state", name: "s2", arguments: [{ name: "a" }] },
                result: { name: "s4", arguments: [{ name: "x", result: { value: "a", valueIsReference: true } }] },
            }],
        },
        {
            name: "m3",
            states: [{ name: "s5" }, { name: "s6" }],
            transitions: [{
                id: "3",
                states: [{ name: "s5" }],
                trigger: { type: "state", name: "s4", arguments: [{ name: "x" }] },
                result: { name: "s6", arguments: [{ name: "y", result: { value: "x", valueIsReference: true } }] },
            }],
        },
    ]
}

/**
 * The lines of the final entry `[id]` in `report`, up to the next bullet: trimmed, except that the
 * lines of its `Examples:` table only lose the indentation of `Examples:` itself, so the table's
 * group gutter (REQ-441) stays visible.
 */
function finalEntryLines(report: string, id: string): string[] {
    const lines = report.split("\n")
    const start = lines.findIndex((line) => line.trim() === `🢂️ [${id}]`)
    assert.ok(start >= 0, `no final entry [${id}] in:\n${report}`)
    const end = lines.findIndex((line, index) => index > start && /^\s*(- |🢂️ )/.test(line))
    let examplesIndent: number | undefined
    return lines.slice(start + 1, end < 0 ? undefined : end)
        .filter((line) => line.trim() !== "")
        .map((line) => {
            if (examplesIndent !== undefined) return line.slice(examplesIndent).trimEnd()
            if (line.trim() === "Examples:") examplesIndent = line.indexOf("Examples:")
            return line.trim()
        })
}

describe("renderTransitionsReport", () => {
    it("[TST-216] → [REQ-439]: lists every result along the chain, innermost first, bound as the scenario asserts it", () => {
        const entry = finalEntryLines(renderTransitionsReport(buildChainedMachines()), "3.1")

        assert.deepEqual(entry.filter((line) => line.startsWith("⏩")), [
            "⏩ [1] `s2` `resulting a` set to `b`",
            "⏩ [2] `s4` `resulting x` set to `resulting a`",
            "⏩ [3] `s6` `resulting y` set to `resulting x`",
        ])
    })

    it("[TST-217] → [REQ-439]: shows only the example columns the scenario renders", () => {
        const entry = finalEntryLines(renderTransitionsReport(buildChainedMachines()), "3.1")
        const examplesIndex = entry.indexOf("Examples:")

        assert.deepEqual(entry.slice(examplesIndex + 1), [
            "  | b | z | resulting y | resulting a | resulting x |",
            "  | 5 | 9 | 5           | 5           | 5           |",
        ])
    })

    it("[TST-218] → [REQ-441]: groups equivalent example rows and marks the pruned ones", () => {
        const machines: StateMachine[] = [{
            name: "m1",
            states: [{ name: "s1" }, { name: "s2" }],
            dataValueCombinations: [
                { a1: "v1", a2: "v3" },
                { a1: "v1", a2: "v4" },
                { a1: "v2", a2: "v3" },
                { a1: "", a2: "v3" },
                { a1: "v2", a2: "v4" },
            ],
            transitions: [{
                id: "1",
                states: [{ name: "s1" }],
                trigger: { type: "event", name: "e", arguments: [{ name: "a1" }, { name: "a2" }] },
                result: { name: "s2" },
            }],
        }]
        const entry = finalEntryLines(renderTransitionsReport(machines), "1")
        const examplesIndex = entry.indexOf("Examples:")

        assert.deepEqual(entry.slice(examplesIndex + 1), [
            "  | a1 | a2 |",
            "┌►| v1 | v3 |",
            "│X| v1 | v4 |",
            "│X| v2 | v3 |",
            "└X| v2 | v4 |",
            "  |    | v3 |",
        ])
    })
})
