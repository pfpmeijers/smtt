/**
 * Tests for equivalent example rows (`equivalence.ts`).
 *
 * Covers:
 *  - Rows that only rename interchangeable values collapse to their first row.
 *  - Literals, empty values, cross-column equalities and concrete attributes keep rows apart.
 *  - What the model distinguishes is collected from conditions, implied conditions and results.
 */

import { describe, it } from "node:test"
import * as assert from "node:assert/strict"

import type { ExampleColumn } from "../examples"
import type { StateMachine } from "../sm.ast.d"
import {
    collectDistinguishedValues,
    groupEquivalentRows,
    pruneEquivalentRows,
    type DistinguishedValues,
} from "../equivalence"

const base = (name: string): ExampleColumn => ({ kind: "base", name, sourceName: name })
const nothing: DistinguishedValues = { literals: new Set(), concreteAttributes: new Set() }

describe("pruneEquivalentRows", () => {
    it("[TST-219] → [REQ-440]: collapses rows that only rename values", () => {
        // `a1` is undefined throughout; `resulting a4` copies `a2`.
        const resultColumn: ExampleColumn = {
            kind: "result", name: "resulting a4", sourceName: "a4", resultValue: "a2", valueIsReference: true,
        }
        const columns = [base("a1"), base("a2"), base("a3"), resultColumn]
        const rows = [
            ["", "v1", "v3", "v1"],
            ["", "v1", "v4", "v1"],
            ["", "v2", "v3", "v2"],
            ["", "v2", "v4", "v2"],
        ]

        assert.deepEqual(pruneEquivalentRows(rows, columns, nothing), [rows[0]])
    })

    it("[TST-220] → [REQ-440]: keeps rows apart that differ in a literal, an empty value or an equality", () => {
        const columns = [base("a1"), base("a2")]
        const distinguished: DistinguishedValues = { literals: new Set(["v1"]), concreteAttributes: new Set() }
        const rows = [
            ["v1", "v3"],
            ["v2", "v3"],
            ["", "v3"],
            ["v3", "v3"],
            ["v4", "v3"],
        ]

        assert.deepEqual(pruneEquivalentRows(rows, columns, distinguished), [
            ["v1", "v3"],
            ["v2", "v3"],
            ["", "v3"],
            ["v3", "v3"],
        ])
    })

    it("[TST-221] → [REQ-440]: never renames a concrete attribute or a literal result", () => {
        const literalResult: ExampleColumn = { kind: "result", name: "resulting a2", sourceName: "a2", resultValue: "v3" }
        const columns = [base("a1"), literalResult]
        const distinguished: DistinguishedValues = { literals: new Set(), concreteAttributes: new Set(["a1"]) }
        const rows = [["v1", "v3"], ["v2", "v3"]]

        assert.deepEqual(pruneEquivalentRows(rows, columns, distinguished), rows)
    })
})

describe("groupEquivalentRows", () => {
    it("[TST-222] → [REQ-440]: orders groups by first occurrence and keeps each group's first row", () => {
        const columns = [base("a1"), base("a2")]
        const rows = [["v1", "v1"], ["v1", "v2"], ["v2", "v2"], ["v3", "v4"]]

        assert.deepEqual(groupEquivalentRows(rows, columns, nothing), [
            [{ cells: ["v1", "v1"], kept: true }, { cells: ["v2", "v2"], kept: false }],
            [{ cells: ["v1", "v2"], kept: true }, { cells: ["v3", "v4"], kept: false }],
        ])
    })
})

describe("collectDistinguishedValues", () => {
    it("[TST-223] → [REQ-440]: collects literals and concrete attributes from the whole model", () => {
        const machines: StateMachine[] = [{
            name: "m1",
            states: [
                { name: "s1", impliedConditions: [{ attribute: "a1", condition: { operator: "=", value: "v1" } }] },
                { name: "s2" },
            ],
            transitions: [{
                states: [{ name: "s1", arguments: [
                    { name: "a2", condition: { operator: "in", value: ["v2", "v3"] } },
                    { name: "a3", condition: { operator: "=", value: "a2", valueIsReference: true } },
                    { name: "a4", condition: { operator: "in range", value: "[1, 3)" } },
                ] }],
                trigger: { type: "event", name: "e", arguments: [{ name: "a5", modifier: "next" }] },
                result: { name: "s2", arguments: [
                    { name: "a6", result: { value: "v4" } },
                    { name: "a7", result: { value: "a2", valueIsReference: true } },
                ] },
            }],
        }]

        const { literals, concreteAttributes } = collectDistinguishedValues(machines)

        assert.deepEqual([...literals].sort(), ["[1, 3)", "v1", "v2", "v3", "v4"])
        assert.deepEqual([...concreteAttributes].sort(), ["a4", "a5"])
    })
})
