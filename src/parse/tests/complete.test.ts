/**
 * Tests for the `completeStateMachines` step (`complete.ts`).
 *
 * Covers:
 *  - Inferred result assignments for transitions landing in a state with a literal implied
 *    condition.
 *  - Attribute inference from all usage sites.
 *  - Synthetic undefined row when the example table is empty.
 *  - Row augmentation for condition-referenced values.
 *  - Implicit definition of an attribute constrained by an attribute-reference condition.
 *  - Combined interactions (empty table + condition value, multi-attribute combos, etc.).
 */

import { describe, it } from "node:test"
import * as assert from "node:assert/strict"

import type { Condition, StateMachine } from "../sm.ast.d"
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

// --- Inferred result assignments ---

describe("completeStateMachines — Step 0: inferred result assignments (REQ-434)", () => {
    it("[TST-186] → [REQ-434]: infers a result assignment for a literal implied condition the transition leaves unset", () => {
        const stateMachines: StateMachine[] = [
            {
                name: "m1",
                states: [
                    { name: "s1" },
                    { name: "s2", impliedConditions: [{ attribute: "a1", condition: { operator: "=", value: "0" } }] },
                ],
                transitions: [
                    { id: "001", states: [{ name: "s1" }], trigger: { type: "event", name: "e1" }, result: { name: "s2" } },
                ],
            },
        ]
        completeStateMachines(stateMachines)
        assert.deepEqual(stateMachines[0].transitions![0].result.arguments, [
            { name: "a1", result: { value: "0" } },
        ])
    })

    it("[TST-187] → [REQ-434]: does not override an explicit result assignment, even a conflicting one", () => {
        const stateMachines: StateMachine[] = [
            {
                name: "m1",
                states: [
                    { name: "s1" },
                    { name: "s2", impliedConditions: [{ attribute: "a1", condition: { operator: "=", value: "0" } }] },
                ],
                transitions: [
                    {
                        id: "001",
                        trigger: { type: "event", name: "e1" },
                        result: { name: "s2", arguments: [{ name: "a1", result: { value: "5" } }] },
                    },
                ],
            },
        ]
        completeStateMachines(stateMachines)
        assert.deepEqual(stateMachines[0].transitions![0].result.arguments, [
            { name: "a1", result: { value: "5" } },
        ])
    })

    it("[TST-188] → [REQ-434]: does not infer anything for a `defined` implied condition", () => {
        const stateMachines: StateMachine[] = [
            {
                name: "m1",
                states: [
                    { name: "s1" },
                    { name: "s2", impliedConditions: [{ attribute: "a1", condition: { operator: "defined" } }] },
                ],
                transitions: [
                    { id: "001", trigger: { type: "event", name: "e1" }, result: { name: "s2" } },
                ],
            },
        ]
        completeStateMachines(stateMachines)
        assert.strictEqual(stateMachines[0].transitions![0].result.arguments, undefined)
    })

    it("[TST-193] → [REQ-434]: infers an explicit clear for an `undefined` implied condition", () => {
        const stateMachines: StateMachine[] = [
            {
                name: "m1",
                states: [
                    { name: "s1" },
                    { name: "s2", impliedConditions: [{ attribute: "a2", condition: { operator: "undefined" } }] },
                ],
                transitions: [
                    { id: "001", trigger: { type: "event", name: "e1" }, result: { name: "s2" } },
                ],
            },
        ]
        completeStateMachines(stateMachines)
        assert.deepEqual(stateMachines[0].transitions![0].result.arguments, [
            { name: "a2", result: {} },
        ])
    })

    it("[TST-194] → [REQ-434]: does not override an explicit result that leaves an `undefined`-declaring target set", () => {
        const stateMachines: StateMachine[] = [
            {
                name: "m1",
                states: [
                    { name: "s1" },
                    { name: "s2", impliedConditions: [{ attribute: "a1", condition: { operator: "undefined" } }] },
                ],
                transitions: [
                    {
                        id: "001",
                        trigger: { type: "event", name: "e1" },
                        result: { name: "s2", arguments: [{ name: "a1", result: { value: "v1" } }] },
                    },
                ],
            },
        ]
        completeStateMachines(stateMachines)
        assert.deepEqual(stateMachines[0].transitions![0].result.arguments, [
            { name: "a1", result: { value: "v1" } },
        ])
    })

    it("[TST-195] → [REQ-434]: overrides a value merely carried over from a precondition that leaves the attribute defined", () => {
        // Mirrors the painting-status bug: a transition's precondition (via the source state's own
        // implied condition) carries the attribute forward as defined, but the target declares it
        // undefined, and the transition's result does not otherwise mention the attribute.
        const stateMachines: StateMachine[] = [
            {
                name: "painting status",
                states: [
                    { name: "reserved", impliedConditions: [{ attribute: "assignee email", condition: { operator: "defined" } }] },
                    { name: "available", impliedConditions: [{ attribute: "assignee email", condition: { operator: "undefined" } }] },
                ],
                data: { "assignee email": "" },
                dataExampleValues: [{ "assignee email": "a@example.com" }],
                transitions: [
                    {
                        id: "043",
                        states: [{ name: "reserved" }],
                        trigger: { type: "event", name: "reservation cancelled" },
                        result: { name: "available" },
                    },
                ],
            },
        ]
        completeStateMachines(stateMachines)
        assert.deepEqual(stateMachines[0].transitions![0].result.arguments, [
            { name: "assignee email", result: {} },
        ])
    })

    it("[TST-189] → [REQ-434]: does not infer anything for a reference-valued implied equality", () => {
        const stateMachines: StateMachine[] = [
            {
                name: "m1",
                states: [
                    { name: "s1" },
                    {
                        name: "s2",
                        impliedConditions: [
                            { attribute: "a1", condition: { operator: "=", value: "a2", valueIsReference: true } },
                        ],
                    },
                ],
                data: { a2: "" },
                dataExampleValues: [{ a2: "v1" }],
                transitions: [
                    { id: "001", trigger: { type: "event", name: "e1" }, result: { name: "s2" } },
                ],
            },
        ]
        completeStateMachines(stateMachines)
        assert.strictEqual(stateMachines[0].transitions![0].result.arguments, undefined)
    })

    it("[TST-190] → [REQ-434]: an inferred assignment is picked up by attribute inference and table augmentation", () => {
        const stateMachines: StateMachine[] = [
            {
                name: "m1",
                states: [
                    { name: "s1" },
                    { name: "s2", impliedConditions: [{ attribute: "a1", condition: { operator: "=", value: "0" } }] },
                ],
                transitions: [
                    { id: "001", trigger: { type: "event", name: "e1" }, result: { name: "s2" } },
                ],
            },
        ]
        completeStateMachines(stateMachines)
        assert.ok("a1" in (stateMachines[0].data ?? {}), "`a1` must be declared")
        const pool = (stateMachines[0].dataExampleValues ?? []).map((r) => r["a1"])
        assert.ok(pool.includes("0"), "the inferred value `0` must reach the example table")
    })

    it("[TST-191] → [REQ-434]: does not add an assignment when the result already references another attribute", () => {
        const stateMachines: StateMachine[] = [
            {
                name: "m1",
                states: [
                    { name: "s1" },
                    { name: "s2", impliedConditions: [{ attribute: "a1", condition: { operator: "=", value: "0" } }] },
                ],
                transitions: [
                    {
                        id: "001",
                        trigger: { type: "event", name: "e1" },
                        result: { name: "s2", arguments: [{ name: "a1", result: { value: "a3", valueIsReference: true } }] },
                    },
                ],
            },
        ]
        completeStateMachines(stateMachines)
        assert.deepEqual(stateMachines[0].transitions![0].result.arguments, [
            { name: "a1", result: { value: "a3", valueIsReference: true } },
        ])
    })

    it("[TST-192] → [REQ-434]: overrides a value merely carried over from a conflicting precondition", () => {
        // Mirrors the cart bug this requirement was introduced for: a transition's precondition
        // pins the attribute to a value the target state's own implied condition contradicts, and
        // the transition's result does not otherwise mention the attribute.
        const stateMachines: StateMachine[] = [
            {
                name: "cart",
                states: [
                    { name: "non-empty", impliedConditions: [{ attribute: "count", condition: { operator: ">", value: "0" } }] },
                    { name: "empty", impliedConditions: [{ attribute: "count", condition: { operator: "=", value: "0" } }] },
                ],
                data: { count: "" },
                dataExampleValues: [{ count: "1" }],
                transitions: [
                    {
                        id: "004",
                        states: [{ name: "non-empty", arguments: [{ name: "count", condition: { operator: "=", value: "1" } }] }],
                        trigger: { type: "event", name: "removed" },
                        result: { name: "empty" },
                    },
                ],
            },
        ]
        completeStateMachines(stateMachines)
        assert.deepEqual(stateMachines[0].transitions![0].result.arguments, [
            { name: "count", result: { value: "0" } },
        ])
    })
})

// --- Attribute inference ---

describe("completeStateMachines — Step A: attribute inference", () => {
    it("[TST-127]: leaves an empty machine unchanged (no data attributes, no rows)", () => {
        const stateMachines = [makeMinimal()]
        completeStateMachines(stateMachines)
        assert.deepEqual(stateMachines[0].data, {})
        assert.deepEqual(stateMachines[0].dataExampleValues ?? [], [])
    })

    it("[TST-128]: infers attributes from dataExampleValues column names", () => {
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

    it("[TST-129]: infers attributes from state implied conditions", () => {
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

    it("[TST-130]: infers attributes from default precondition arguments", () => {
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

    it("[TST-131]: infers attributes from transition state arguments", () => {
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

    it("[TST-132]: infers attributes from trigger arguments", () => {
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

    it("[TST-133]: infers attributes from result arguments", () => {
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

    it("[TST-134]: does not overwrite existing data entries", () => {
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

    it("[TST-135]: infers attributes from multiple sources and deduplicates", () => {
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
    it("[TST-136]: synthesizes a single all-empty row when the example table is absent", () => {
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

    it("[TST-137]: synthesizes a single all-empty row when dataExampleValues is an empty array", () => {
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

    it("[TST-138]: does not add a row for a machine that has no data attributes", () => {
        const stateMachines = [makeMinimal()]
        completeStateMachines(stateMachines)
        assert.deepEqual(stateMachines[0].dataExampleValues ?? [], [])
    })

    it("[TST-139]: back-fills missing attribute columns into existing rows", () => {
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

    it("[TST-140]: infers attributes and then synthesizes the undefined row in one pass", () => {
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
    it("[TST-141] → [REQ-421]: synthesizes a row for a missing condition value in a transition state arg", () => {
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

    it("[TST-142] → [REQ-421]: synthesizes a row for a missing condition value in a trigger argument", () => {
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

    it("[TST-143] → [REQ-421]: synthesizes a row for a missing result value in a result argument", () => {
        const stateMachines = [clone(makeWithData())]
        stateMachines[0].transitions = [
            {
                trigger: { type: "event", name: "e1" },
                result: { name: "s2", arguments: [{ name: "a1", result: { value: "v1" } }] },
            },
        ]
        completeStateMachines(stateMachines)
        const pool = (stateMachines[0].dataExampleValues ?? []).map((r) => r["a1"])
        assert.ok(pool.includes("v1"), "synthesized row must contain the result value")
    })

    it("[TST-144] → [REQ-421]: synthesizes a row for a missing condition value in a state implied condition", () => {
        const stateMachines = [clone(makeWithData())]
        stateMachines[0].states[0].impliedConditions = [
            { attribute: "a1", condition: { operator: "=", value: "v1" } },
        ]
        completeStateMachines(stateMachines)
        const pool = (stateMachines[0].dataExampleValues ?? []).map((r) => r["a1"])
        assert.ok(pool.includes("v1"), "synthesized row must contain the implied condition value")
    })

    it("[TST-145] → [REQ-421]: synthesizes a row for a missing condition value in a default precondition", () => {
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

    it("[TST-146]: combines multiple conditions in one transition into a single synthesized row", () => {
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

    it("[TST-147]: does not add duplicate rows when condition value already exists", () => {
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

    it("[TST-148]: handles 'in' conditions: synthesizes a row for each missing value", () => {
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

    it("[TST-149]: handles 'in range' conditions: synthesizes rows for both boundary values when missing", () => {
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

    it("[TST-150]: fills other-attribute columns using first existing row value when synthesising", () => {
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

    it("[TST-151]: interaction: empty table + condition value → row with condition value and '' for other attrs", () => {
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

    it("[TST-152]: interaction: no data section + condition value → attribute is inferred and row is synthesized", () => {
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

    it("[TST-153]: keeps the example table in deterministic order after augmentation", () => {
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

// --- Attribute-reference result values ---

describe("completeStateMachines — attribute-reference result values", () => {
    it("[TST-154] → [REQ-419]: does not register a result argument whose result references another attribute", () => {
        const stateMachines: StateMachine[] = [
            {
                name: "m1",
                states: [{ name: "s1" }, { name: "s2" }],
                data: { a1: "" },
                dataExampleValues: [{ a1: "v1" }],
                transitions: [
                    {
                        trigger: { type: "event", name: "e1" },
                        result: {
                            name: "s2",
                            arguments: [{ name: "a2", result: { value: "a1", valueIsReference: true } }],
                        },
                    },
                ],
            },
        ]
        completeStateMachines(stateMachines)
        assert.ok(!("a2" in (stateMachines[0].data ?? {})), "`a2` must not be registered from a reference-only occurrence")
    })

    it("[TST-155] → [REQ-419]: still registers a reference-valued result attribute when it's genuinely used elsewhere", () => {
        const stateMachines: StateMachine[] = [
            {
                name: "m1",
                states: [{ name: "s1" }, { name: "s2" }],
                data: { a1: "" },
                dataExampleValues: [{ a1: "v1" }],
                transitions: [
                    {
                        trigger: { type: "event", name: "e1", arguments: [{ name: "a2" }] },
                        result: {
                            name: "s2",
                            arguments: [{ name: "a2", result: { value: "a1", valueIsReference: true } }],
                        },
                    },
                ],
            },
        ]
        completeStateMachines(stateMachines)
        assert.ok("a2" in (stateMachines[0].data ?? {}), "`a2` must still be registered via its own trigger-argument usage")
    })

    it("[TST-156] → [REQ-421]: does not synthesize a row treating the referenced attribute's name as a literal value", () => {
        const stateMachines: StateMachine[] = [
            {
                name: "m1",
                states: [{ name: "s1" }, { name: "s2" }],
                data: { a1: "" },
                dataExampleValues: [{ a1: "v1" }],
                transitions: [
                    {
                        trigger: { type: "event", name: "e1" },
                        result: {
                            name: "s2",
                            arguments: [{ name: "a2", result: { value: "a1", valueIsReference: true } }],
                        },
                    },
                ],
            },
        ]
        completeStateMachines(stateMachines)
        const pool = (stateMachines[0].dataExampleValues ?? []).map((r) => r["a1"])
        assert.deepEqual(pool, ["v1"], "no row synthesized for a reference's target attribute name")
    })
})
// --- Attribute-reference condition values ---

/**
 * A condition comparing an attribute against another attribute's value, e.g. `` `a2` as `a1` ``.
 *
 * @param attributeName Name of the referenced attribute.
 * @param operator Comparison operator; defaults to the text equality form.
 * @returns The reference-valued condition.
 */
function referenceCondition(attributeName: string, operator: Condition["operator"] = "as"): Condition {
    return { operator, value: attributeName, valueIsReference: true }
}

describe("completeStateMachines — attribute-reference condition values", () => {
    it("[TST-169] → [REQ-419]: registers the attribute constrained by a reference condition", () => {
        const stateMachines: StateMachine[] = [
            {
                name: "m1",
                states: [{ name: "s1" }, { name: "s2" }],
                data: { a1: "" },
                dataExampleValues: [{ a1: "v1" }],
                transitions: [
                    {
                        trigger: {
                            type: "event",
                            name: "e1",
                            arguments: [{ name: "a2", condition: referenceCondition("a1") }],
                        },
                        result: { name: "s2" },
                    },
                ],
            },
        ]
        completeStateMachines(stateMachines)
        assert.ok("a2" in (stateMachines[0].data ?? {}), "`a2` must be registered by its own condition occurrence")
    })

    it("[TST-170] → [REQ-426]: implies a row per value of the referenced attribute", () => {
        const stateMachines: StateMachine[] = [
            {
                name: "m1",
                states: [{ name: "s1" }, { name: "s2" }],
                data: { a1: "" },
                dataExampleValues: [{ a1: "1" }, { a1: "2" }],
                transitions: [
                    {
                        states: [{ name: "s1", arguments: [{ name: "a2", condition: referenceCondition("a1", "=") }] }],
                        trigger: { type: "event", name: "e1" },
                        result: { name: "s2" },
                    },
                ],
            },
        ]
        completeStateMachines(stateMachines)
        assert.deepEqual(stateMachines[0].dataExampleValues, [
            { a1: "1", a2: "" },
            { a1: "2", a2: "" },
            { a1: "1", a2: "1" },
            { a1: "2", a2: "2" },
        ])
    })

    it("[TST-171] → [REQ-426]: implies the value pinned by a literal condition in the same context", () => {
        const stateMachines: StateMachine[] = [
            {
                name: "m1",
                states: [{ name: "s1" }, { name: "s2" }],
                data: { a1: "" },
                dataExampleValues: [{ a1: "1" }, { a1: "2" }],
                transitions: [
                    {
                        states: [{
                            name: "s1",
                            arguments: [
                                { name: "a1", condition: { operator: "=", value: "2" } },
                                { name: "a2", condition: referenceCondition("a1", "=") },
                            ],
                        }],
                        trigger: { type: "event", name: "e1" },
                        result: { name: "s2" },
                    },
                ],
            },
        ]
        completeStateMachines(stateMachines)
        // Only the combination satisfying both the literal condition and the reference is implied.
        assert.deepEqual(stateMachines[0].dataExampleValues, [
            { a1: "1", a2: "" },
            { a1: "2", a2: "" },
            { a1: "2", a2: "2" },
        ])
    })

    it("[TST-172] → [REQ-426]: implies a row for a state's implied reference condition", () => {
        const stateMachines: StateMachine[] = [
            {
                name: "m1",
                states: [
                    { name: "s1" },
                    { name: "s2", impliedConditions: [{ attribute: "a2", condition: referenceCondition("a1", "=") }] },
                ],
                data: { a1: "" },
                dataExampleValues: [{ a1: "v1" }],
                transitions: [],
            },
        ]
        completeStateMachines(stateMachines)
        assert.deepEqual(stateMachines[0].dataExampleValues, [
            { a1: "v1", a2: "" },
            { a1: "v1", a2: "v1" },
        ])
    })

    it("[TST-173] → [REQ-426]: implies no row for a non-equality reference condition", () => {
        const stateMachines: StateMachine[] = [
            {
                name: "m1",
                states: [{ name: "s1" }, { name: "s2" }],
                data: { a1: "" },
                dataExampleValues: [{ a1: "1" }, { a1: "2" }],
                transitions: [
                    {
                        states: [{
                            name: "s1", arguments: [{ name: "a2", condition: referenceCondition("a1", "<>") }],
                        }],
                        trigger: { type: "event", name: "e1" },
                        result: { name: "s2" },
                    },
                ],
            },
        ]
        completeStateMachines(stateMachines)
        // `<>` states what the value must *not* be, so no single value follows from the reference.
        assert.deepEqual(stateMachines[0].dataExampleValues, [
            { a1: "1", a2: "" },
            { a1: "2", a2: "" },
        ])
    })

    it("[TST-174] → [REQ-426]: implies no row when the referenced attribute has no defined value", () => {
        const stateMachines: StateMachine[] = [
            {
                name: "m1",
                states: [{ name: "s1" }, { name: "s2" }],
                data: {},
                dataExampleValues: [],
                transitions: [
                    {
                        states: [{ name: "s1", arguments: [{ name: "a2", condition: referenceCondition("foreign", "=") }] }],
                        trigger: { type: "event", name: "e1" },
                        result: { name: "s2" },
                    },
                ],
            },
        ]
        completeStateMachines(stateMachines)
        // `foreign` is declared by another machine, so this machine has no value to copy.
        assert.deepEqual(stateMachines[0].dataExampleValues, [{ a2: "" }])
    })
})
