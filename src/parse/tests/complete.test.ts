/**
 * Tests for the `completeStateMachines` step (`complete.ts`).
 *
 * Covers:
 *  - Attribute inference from all usage sites.
 *  - Synthetic undefined row when the example table is empty.
 *  - Row augmentation for condition-referenced values.
 *  - Combined interactions (empty table + condition value, multi-attribute combos, etc.).
 */

import { describe, it } from "node:test"
import * as assert from "node:assert/strict"

import type { StateMachine } from "../sm.ast.d"
import { completeStateMachines } from "../complete"

function clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T
}

// --- Fixture helpers ---

/** A minimal two-state machine with no data at all. */
function makeMinimal(): StateMachine {
    return {
        name: "m1",
        states: [{ name: "s1" }, { name: "s2" }],
        transitions: [],
    }
}

/** A machine that already has explicit data and example rows. */
function makeWithData(): StateMachine {
    return {
        name: "m1",
        states: [{ name: "s1" }, { name: "s2" }],
        data: { a1: "v1", a2: "v2" },
        dataExampleValues: [
            { a1: "v1", a2: "1" },
            { a1: "v2", a2: "2" },
        ],
        transitions: [],
    }
}

// --- Attribute inference ---

describe("completeStateMachines — Step A: attribute inference", () => {
    it("leaves an empty machine unchanged (no data attributes, no rows)", () => {
        const stateMachines = [makeMinimal()]
        completeStateMachines(stateMachines)
        assert.deepEqual(stateMachines[0].data, {})
        assert.deepEqual(stateMachines[0].dataExampleValues ?? [], [])
    })

    it("infers attributes from dataExampleValues column names", () => {
        const stateMachines: StateMachine[] = [
            {
                name: "m1",
                states: [{ name: "s1" }],
                dataExampleValues: [{ a1: "x", a2: "y" }],
                transitions: [],
            },
        ]
        completeStateMachines(stateMachines)
        assert.ok("a1" in (stateMachines[0].data ?? {}), "`a1` (lowercased) should be inferred")
        assert.ok("a2" in (stateMachines[0].data ?? {}), "`a2` (lowercased) should be inferred")
    })

    it("infers attributes from state implied conditions", () => {
        const stateMachines: StateMachine[] = [
            {
                name: "m1",
                states: [
                    {
                        name: "s1",
                        impliedConditions: [{ attribute: "a1", condition: { operator: "=", value: "v1" } }],
                    },
                ],
                transitions: [],
            },
        ]
        completeStateMachines(stateMachines)
        assert.ok("a1" in (stateMachines[0].data ?? {}), "`a1` should be inferred from implied condition")
        assert.strictEqual(stateMachines[0].data!["a1"], "", "description should be empty string")
    })

    it("infers attributes from default precondition arguments", () => {
        const m2: StateMachine = { name: "m2", states: [{ name: "s3" }], transitions: [] }
        const m1: StateMachine = {
            name: "m1",
            states: [{ name: "s1" }],
            defaultPreconditions: [{ state: "s3", arguments: [{ name: "a1" }] }],
            transitions: [],
        }
        completeStateMachines([m1, m2])
        assert.ok("a1" in (m1.data ?? {}), "`a1` should be inferred from default precondition argument")
    })

    it("infers attributes from transition state arguments", () => {
        const m2: StateMachine = { name: "m2", states: [{ name: "s3" }], transitions: [] }
        const m1: StateMachine = {
            name: "m1",
            states: [{ name: "s1" }, { name: "s2" }],
            transitions: [
                {
                    states: [{ name: "s3", arguments: [{ name: "a1" }] }],
                    trigger: { type: "event", name: "e1" },
                    result: { name: "s2" },
                },
            ],
        }
        completeStateMachines([m1, m2])
        assert.ok("a1" in (m1.data ?? {}), "`a1` should be inferred from transition state argument")
    })

    it("infers attributes from trigger arguments", () => {
        const stateMachines: StateMachine[] = [
            {
                name: "m1",
                states: [{ name: "s1" }, { name: "s2" }],
                transitions: [
                    {
                        trigger: { type: "event", name: "e1", arguments: [{ name: "a1" }] },
                        result: { name: "s2" },
                    },
                ],
            },
        ]
        completeStateMachines(stateMachines)
        assert.ok("a1" in (stateMachines[0].data ?? {}), "`a1` should be inferred from trigger argument")
    })

    it("infers attributes from result arguments", () => {
        const stateMachines: StateMachine[] = [
            {
                name: "m1",
                states: [{ name: "s1" }, { name: "s2" }],
                transitions: [
                    {
                        trigger: { type: "event", name: "e1" },
                        result: { name: "s2", arguments: [{ name: "a1" }] },
                    },
                ],
            },
        ]
        completeStateMachines(stateMachines)
        assert.ok("a1" in (stateMachines[0].data ?? {}), "`a1` should be inferred from result argument")
    })

    it("does not overwrite existing data entries", () => {
        const stateMachines: StateMachine[] = [
            {
                name: "m1",
                states: [{ name: "s1" }, { name: "s2" }],
                data: { a1: "..." },
                transitions: [
                    {
                        trigger: { type: "event", name: "e1", arguments: [{ name: "a1" }] },
                        result: { name: "s2" },
                    },
                ],
            },
        ]
        completeStateMachines(stateMachines)
        assert.strictEqual(stateMachines[0].data!["a1"], "...", "existing description must be preserved")
    })

    it("infers attributes from multiple sources and deduplicates", () => {
        const stateMachines: StateMachine[] = [
            {
                name: "m1",
                states: [
                    {
                        name: "s1",
                        impliedConditions: [{ attribute: "a1", condition: { operator: "=", value: "v1" } }],
                    },
                    { name: "s2" },
                ],
                dataExampleValues: [{ a1: "v1" }],
                transitions: [
                    {
                        trigger: { type: "event", name: "e1", arguments: [{ name: "a2" }] },
                        result: { name: "s2" },
                    },
                ],
            },
        ]
        completeStateMachines(stateMachines)
        const keys = Object.keys(stateMachines[0].data ?? {})
        assert.strictEqual(keys.filter((k) => k === "a1").length, 1, "`a1` should appear only once")
    })
})

// --- Undefined row synthesis ---

describe("completeStateMachines — Step B: undefined row synthesis", () => {
    it("synthesizes a single all-empty row when the example table is absent", () => {
        const stateMachines: StateMachine[] = [
            {
                name: "m1",
                states: [{ name: "s1" }, { name: "s2" }],
                data: { a1: "", a2: "" },
                transitions: [],
            },
        ]
        completeStateMachines(stateMachines)
        assert.strictEqual(stateMachines[0].dataExampleValues?.length, 1)
        assert.deepEqual(stateMachines[0].dataExampleValues![0], { a1: "", a2: "" })
    })

    it("synthesizes a single all-empty row when dataExampleValues is an empty array", () => {
        const stateMachines: StateMachine[] = [
            {
                name: "m1",
                states: [{ name: "s1" }],
                data: { a1: "v1" },
                dataExampleValues: [],
                transitions: [],
            },
        ]
        completeStateMachines(stateMachines)
        assert.strictEqual(stateMachines[0].dataExampleValues?.length, 1)
        assert.deepEqual(stateMachines[0].dataExampleValues![0], { a1: "" })
    })

    it("does not add a row for a machine that has no data attributes", () => {
        const stateMachines = [makeMinimal()]
        completeStateMachines(stateMachines)
        assert.deepEqual(stateMachines[0].dataExampleValues ?? [], [])
    })

    it("back-fills missing attribute columns into existing rows", () => {
        const stateMachines: StateMachine[] = [
            {
                name: "m1",
                states: [{ name: "s1" }],
                data: { a1: "", a2: "", a3: "" },
                dataExampleValues: [{ a1: "1", a2: "2" }], // `a3` is missing
                transitions: [],
            },
        ]
        completeStateMachines(stateMachines)
        assert.strictEqual(stateMachines[0].dataExampleValues?.[0].a3, "", "`a3` should be back-filled with \"\"")
    })

    it("infers attributes and then synthesizes the undefined row in one pass", () => {
        const stateMachines: StateMachine[] = [
            {
                name: "m1",
                states: [{ name: "s1" }, { name: "s2" }],
                transitions: [
                    {
                        trigger: { type: "event", name: "e1", arguments: [{ name: "a1" }] },
                        result: { name: "s2" },
                    },
                ],
            },
        ]
        completeStateMachines(stateMachines)
        assert.ok("a1" in (stateMachines[0].data ?? {}))
        assert.strictEqual(stateMachines[0].dataExampleValues?.length, 1)
        assert.deepEqual(stateMachines[0].dataExampleValues![0], { a1: "" })
    })
})

// --- Condition-value row augmentation ---

describe("completeStateMachines — Step C: condition-value augmentation", () => {
    it("REQ-421: synthesizes a row for a missing condition value in a transition state arg", () => {
        const stateMachines = [
            clone(makeWithData()),
        ]
        stateMachines[0].transitions = [
            {
                states: [
                    {
                        name: "s1",
                        arguments: [{ name: "a1", condition: { operator: "=", value: "unknown_val" } }],
                    },
                ],
                trigger: { type: "event", name: "e1" },
                result: { name: "s2" },
            },
        ]
        completeStateMachines(stateMachines)
        const pool = (stateMachines[0].dataExampleValues ?? []).map((r) => r["a1"])
        assert.ok(pool.includes("unknown_val"), "synthesized row must contain the condition value")
    })

    it("REQ-421: synthesizes a row for a missing condition value in a trigger argument", () => {
        const stateMachines = [clone(makeWithData())]
        stateMachines[0].transitions = [
            {
                trigger: { type: "event", name: "e1", arguments: [{ name: "a1", condition: { operator: "=", value: "v1" } }] },
                result: { name: "s2" },
            },
        ]
        completeStateMachines(stateMachines)
        const pool = (stateMachines[0].dataExampleValues ?? []).map((r) => r["a1"])
        assert.ok(pool.includes("v1"), "synthesized row must contain the trigger condition value")
    })

    it("REQ-421: synthesizes a row for a missing condition value in a result argument", () => {
        const stateMachines = [clone(makeWithData())]
        stateMachines[0].transitions = [
            {
                trigger: { type: "event", name: "e1" },
                result: { name: "s2", arguments: [{ name: "a1", condition: { operator: "=", value: "v1" } }] },
            },
        ]
        completeStateMachines(stateMachines)
        const pool = (stateMachines[0].dataExampleValues ?? []).map((r) => r["a1"])
        assert.ok(pool.includes("v1"), "synthesized row must contain the result condition value")
    })

    it("REQ-421: synthesizes a row for a missing condition value in a state implied condition", () => {
        const stateMachines = [clone(makeWithData())]
        stateMachines[0].states[0].impliedConditions = [
            { attribute: "a1", condition: { operator: "=", value: "v1" } },
        ]
        completeStateMachines(stateMachines)
        const pool = (stateMachines[0].dataExampleValues ?? []).map((r) => r["a1"])
        assert.ok(pool.includes("v1"), "synthesized row must contain the implied condition value")
    })

    it("REQ-421: synthesizes a row for a missing condition value in a default precondition", () => {
        const m2: StateMachine = {
            name: "m2",
            states: [{ name: "s3" }],
            data: { a1: "" },
            dataExampleValues: [{ a1: "v1" }, { a1: "v2" }],
            transitions: [],
        }
        const m1: StateMachine = {
            name: "m1",
            states: [{ name: "s1" }, { name: "s2" }],
            defaultPreconditions: [
                { state: "s3", arguments: [{ name: "a1", condition: { operator: "=", value: "v3" } }] },
            ],
            transitions: [],
        }
        completeStateMachines([m1, m2])
        // Note: complete.ts operates per-machine and does not cross-resolve default precondition
        // ownership. m1's default precondition condition is synthesized into m1's own table.
        const m1Pool = (m1.dataExampleValues ?? []).map((r) => r["a1"])
        assert.ok(m1Pool.includes("v3"), "`m1` synthesized row must contain the default precondition value")
    })

    it("combines multiple conditions in one transition into a single synthesized row", () => {
        const stateMachines: StateMachine[] = [
            {
                name: "m1",
                states: [{ name: "s1" }, { name: "s2" }],
                data: { a: "", b: "" },
                dataExampleValues: [{ a1: "v1", a2: "v2" }],
                transitions: [
                    {
                        trigger: {
                            type: "event",
                            name: "e",
                            arguments: [
                                { name: "a1", condition: { operator: "=", value: "v3" } },
                                { name: "a2", condition: { operator: "=", value: "v4" } },
                            ],
                        },
                        result: { name: "s2" },
                    },
                ],
            },
        ]
        completeStateMachines(stateMachines)
        const rows = stateMachines[0].dataExampleValues ?? []
        const combined = rows.find((r) => r["a1"] === "v3" && r["a2"] === "v4")
        assert.ok(combined, "a single combined row {a1:'v3', a2:'v4'} must be synthesized")
        // The original row must still be present
        const original = rows.find((r) => r["a1"] === "v1" && r["a2"] === "v2")
        assert.ok(original, "original rows must be preserved")
    })

    it("does not add duplicate rows when condition value already exists", () => {
        const stateMachines = [clone(makeWithData())]
        stateMachines[0].transitions = [
            {
                trigger: {
                    type: "event",
                    name: "e1",
                    arguments: [{ name: "a1", condition: { operator: "=", value: "v1" } }]
                },
                result: { name: "s2" },
            },
        ]
        const before = stateMachines[0].dataExampleValues!.length
        completeStateMachines(stateMachines)
        assert.strictEqual(
            stateMachines[0].dataExampleValues!.length,
            before,
            "no rows should be added when the value is already present",
        )
    })

    it("handles 'in' conditions: synthesizes a row for each missing value", () => {
        const stateMachines = [clone(makeWithData())]
        stateMachines[0].transitions = [
            {
                trigger: {
                    type: "event",
                    name: "e1",
                    arguments: [
                        { name: "a1", condition: { operator: "in", value: ["v1", "v2", "v3"] } },
                    ],
                },
                result: { name: "s2" },
            },
        ]
        completeStateMachines(stateMachines)
        const pool = (stateMachines[0].dataExampleValues ?? []).map((r) => r["a1"])
        assert.ok(pool.includes("v2"), "v2 must be synthesized")
        assert.ok(pool.includes("v3"), "v3 must be synthesized")
    })

    it("handles 'in range' conditions: synthesizes rows for both boundary values when missing", () => {
        const stateMachines: StateMachine[] = [
            {
                name: "m1",
                states: [{ name: "s1" }, { name: "s2" }],
                data: { a1: "" },
                dataExampleValues: [{ a1: "5" }],
                transitions: [
                    {
                        trigger: {
                            type: "event",
                            name: "e1",
                            arguments: [{ name: "a1", condition: { operator: "in range", value: "[1, 99]" } }],
                        },
                        result: { name: "s2" },
                    },
                ],
            },
        ]
        completeStateMachines(stateMachines)
        const pool = (stateMachines[0].dataExampleValues ?? []).map((r) => r["a1"])
        assert.ok(pool.includes("1"), "lower boundary 1 must be synthesized")
        assert.ok(pool.includes("99"), "upper boundary 99 must be synthesized")
    })

    it("fills other-attribute columns using first existing row value when synthesising", () => {
        const stateMachines: StateMachine[] = [
            {
                name: "m1",
                states: [{ name: "s1" }, { name: "s2" }],
                dataExampleValues: [{ a1: "v1", a2: "v2" }],
                transitions: [
                    {
                        trigger: {
                            type: "event",
                            name: "e1",
                            arguments: [{ name: "a1", condition: { operator: "=", value: "v3" } }],
                        },
                        result: { name: "s2" },
                    },
                ],
            },
        ]
        completeStateMachines(stateMachines)
        const rows = stateMachines[0].dataExampleValues ?? []
        const synthesized = rows.find((r) => r["a1"] === "v3")
        assert.ok(synthesized, "synthesized row must exist")
        assert.strictEqual(synthesized!["a2"], "v2", "unconstrained attribute `a2` should use first available value")
    })

    it("interaction: empty table + condition value → row with condition value and '' for other attrs", () => {
        const stateMachines: StateMachine[] = [
            {
                name: "m1",
                states: [{ name: "s1" }, { name: "s2" }],
                data: { a1: "", a2: "" },
                dataExampleValues: [],
                transitions: [
                    {
                        trigger: {
                            type: "event",
                            name: "e1",
                            arguments: [{ name: "a1", condition: { operator: "=", value: "v1" } }],
                        },
                        result: { name: "s2" },
                    },
                ],
            },
        ]
        completeStateMachines(stateMachines)
        const rows = stateMachines[0].dataExampleValues ?? []
        assert.ok(rows.length >= 1, "at least one row should exist")
        const match = rows.find((r) => r["a1"] === "v1")
        assert.ok(match, "row with `a1=v1' must be synthesized")
        assert.strictEqual(match!["a2"], "", "`a2` should be '' when the original row has no `a2` value")
    })

    it("interaction: no data section + condition value → attribute is inferred and row is synthesized", () => {
        const stateMachines: StateMachine[] = [
            {
                name: "m1",
                states: [{ name: "s1" }, { name: "s2" }],
                transitions: [
                    {
                        trigger: {
                            type: "event",
                            name: "e1",
                            arguments: [{ name: "a1", condition: { operator: "=", value: "v1" } }]
                        },
                        result: { name: "s2" },
                    },
                ],
            },
        ]
        completeStateMachines(stateMachines)
        assert.ok("a1" in (stateMachines[0].data ?? {}), "`a1` must be inferred")
        const pool = (stateMachines[0].dataExampleValues ?? []).map((r) => r["a1"])
        assert.ok(pool.includes("v1"), "`v1` must be synthesized")
    })

    it("keeps the example table in deterministic order after augmentation", () => {
        const stateMachines: StateMachine[] = [
            {
                name: "m1",
                states: [{ name: "s1" }, { name: "s2" }],
                data: { a1: "" },
                dataExampleValues: [{ a1: "v1" }],
                transitions: [
                    {
                        trigger: { type: "event", name: "e1", arguments: [{ name: "a1", condition: { operator: "=", value: "v2" } }] },
                        result: { name: "s2" },
                    },
                    {
                        trigger: { type: "event", name: "e2", arguments: [{ name: "a1", condition: { operator: "=", value: "v3" } }] },
                        result: { name: "s2" },
                    },
                ],
            },
        ]
        completeStateMachines(stateMachines)
        const values = (stateMachines[0].dataExampleValues ?? []).map((r) => r["a1"])
        const sorted = [...values].sort((a, b) => a.localeCompare(b))
        assert.deepEqual(values, sorted, "rows should be sorted alphabetically by attribute value")
    })
})

