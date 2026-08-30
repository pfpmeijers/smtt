import { describe, it } from "node:test"
import * as assert from "node:assert/strict"

import type { StateMachine } from "../sm.ast.d"
import { validateStateMachines } from "../validate"

function cloneStateMachines(stateMachines: StateMachine[]): StateMachine[] {
    return JSON.parse(JSON.stringify(stateMachines)) as StateMachine[]
}

function buildValidStateMachines(): StateMachine[] {
    return [
        {
            name: "m1",
            states: [{ name: "s1" }, { name: "s2" }],
            defaultPreconditions: [{ state: "s3" }],
            transitions: [
                {
                    id: "001",
                    states: [{ name: "s3" }],
                    trigger: { type: "event", name: "e1" },
                    result: { name: "s2" },
                },
            ],
            dataExampleValues: [
                { a1: "v1", a2: "1" },
                { a1: "v2", a2: "2" },
                { a1: "v3", a2: "3" },
            ],
        },
        {
            name: "m2",
            states: [{ name: "s3" }, { name: "s4" }],
            transitions: [],
            dataExampleValues: [{ a1: "v1", a2: "1" }],
        },
    ]
}

describe("validateStateMachines business rules", () => {
    it("accepts a valid AST", () => {
        const stateMachines = buildValidStateMachines()
        stateMachines[0].data = { a1: "", a2: "" }
        stateMachines[1].data = { a1: "", a2: "" }
        assert.doesNotThrow(() => validateStateMachines(stateMachines))
    })

    it("REQ-402: rejects duplicate state names across machines", () => {
        const stateMachines = buildValidStateMachines()
        stateMachines[1].states.push({ name: "s1" })

        assert.throws(
            () => validateStateMachines(stateMachines),
            /State name `s1` is declared in state machines `m1` and `m2`/,
        )
    })

    it("REQ-403: rejects unknown precondition state references", () => {
        const stateMachines = buildValidStateMachines()
        stateMachines[0].transitions?.[0].states?.push({ name: "s9" })

        assert.throws(
            () => validateStateMachines(stateMachines),
            /Precondition state `s9` is not declared in any state machine/,
        )
    })

    it("REQ-404: rejects unknown state triggers", () => {
        const stateMachines = buildValidStateMachines()
        stateMachines[0].transitions = [
            {
                id: "001",
                trigger: { type: "state", name: "s9" },
                result: { name: "s2" },
            },
        ]

        assert.throws(
            () => validateStateMachines(stateMachines),
            /State trigger `s9` is not declared in any state machine/,
        )
    })

    it("REQ-405: rejects result states that are not owned by the transition machine", () => {
        const stateMachines = buildValidStateMachines()
        if (stateMachines[0].transitions?.[0]) {
            stateMachines[0].transitions[0].result.name = "s3"
        }

        assert.throws(
            () => validateStateMachines(stateMachines),
            /Result state `s3` is not a declared state of this machine/,
        )
    })

    it("REQ-406: rejects state triggers that reference own-machine states", () => {
        const stateMachines = buildValidStateMachines()
        stateMachines[0].transitions = [
            {
                id: "001",
                trigger: { type: "state", name: "s1" },
                result: { name: "s2" },
            },
        ]

        assert.throws(
            () => validateStateMachines(stateMachines),
            /State trigger `s1` belongs to the same state machine/,
        )
    })

    it("REQ-407: rejects duplicate precondition names in one transition", () => {
        const stateMachines = buildValidStateMachines()
        stateMachines[0].transitions = [
            {
                id: "001",
                states: [{ name: "s3" }, { name: "S3" }],
                trigger: { type: "event", name: "e1" },
                result: { name: "s2" },
            },
        ]

        assert.throws(
            () => validateStateMachines(stateMachines),
            /appears more than once in the precondition list/,
        )
    })

    it("REQ-408: rejects two preconditions from the same owning machine", () => {
        const stateMachines = buildValidStateMachines()
        stateMachines[0].transitions = [
            {
                id: "001",
                states: [{ name: "s3" }, { name: "s4" }],
                trigger: { type: "event", name: "e1" },
                result: { name: "s2" },
            },
        ]

        assert.throws(
            () => validateStateMachines(stateMachines),
            /Precondition list contains two states from machine `m2`/,
        )
    })

    it("REQ-412: rejects modifiers without a base reference in the same transition", () => {
        const stateMachines = buildValidStateMachines()
        stateMachines[0].transitions = [
            {
                id: "001",
                states: [{ name: "s3" }],
                trigger: { type: "event", name: "e1", arguments: [{ name: "a1", modifier: "not" }] },
                result: { name: "s2" },
            },
        ]

        assert.throws(
            () => validateStateMachines(stateMachines),
            /Modifier `not` on attribute `a1` has no base reference in this transition/,
        )
    })

    it("REQ-413: rejects not-like modifiers when value pool has fewer than 2 distinct values", () => {
        const stateMachines = cloneStateMachines(buildValidStateMachines())
        stateMachines[0].dataExampleValues = [{ a1: "v1" }]
        stateMachines[1].dataExampleValues = [{ a1: "v1" }]
        stateMachines[0].transitions = [
            {
                id: "001",
                states: [{ name: "s3" }],
                trigger: {
                    type: "event",
                    name: "e1",
                    arguments: [{ name: "a1" }, { name: "a1", modifier: "not" }],
                },
                result: { name: "s2" },
            },
        ]

        assert.throws(
            () => validateStateMachines(stateMachines),
            /requires at least 2 distinct values in the values pool, but only `1` was found/,
        )
    })

    it("REQ-414: rejects incremented-like modifiers when value pool contains non-numeric values", () => {
        const stateMachines = cloneStateMachines(buildValidStateMachines())
        stateMachines[0].dataExampleValues = [{ a2: "1" }, { a2: "x" }]
        stateMachines[1].dataExampleValues = []
        stateMachines[0].transitions = [
            {
                id: "001",
                states: [{ name: "s3" }],
                trigger: {
                    type: "event",
                    name: "e1",
                    arguments: [{ name: "a2" }, { name: "a2", modifier: "incremented" }],
                },
                result: { name: "s2" },
            },
        ]

        assert.throws(
            () => validateStateMachines(stateMachines),
            /State machine `m1`: Modifier `incremented` on attribute `a2` - value `x` in the values pool is not numeric\./,
        )
    })

    it("REQ-415: rejects non-equality operators on result argument conditions", () => {
        const stateMachines = cloneStateMachines(buildValidStateMachines())
        stateMachines[0].transitions = [
            {
                id: "001",
                trigger: { type: "event", name: "e1" },
                result: {
                    name: "s2",
                    arguments: [{ name: "a2", condition: { operator: ">=", value: "2" } }],
                },
            },
        ]

        assert.throws(
            () => validateStateMachines(stateMachines),
            /Result argument `a2` has a non-equality condition operator `>=`/,
        )
    })
    it("REQ-417: rejects Example values tables missing columns for declared attributes", () => {
        const stateMachines = cloneStateMachines(buildValidStateMachines())
        stateMachines[0].data = { a1: "", a2: "" }
        stateMachines[0].dataExampleValues = [{ a1: "v1" }]

        assert.throws(
            () => validateStateMachines(stateMachines),
            /Example values table is missing column\(s\) for declared attribute\(s\): `a2` \(REQ-417\)/,
        )
    })

    it("REQ-418: accepts valid condition values from dataExampleValues, and undefined operator", () => {
        const stateMachines = cloneStateMachines(buildValidStateMachines())
        stateMachines[0].states[0].impliedConditions = [
            { attribute: "a1", condition: { operator: "=", value: "v1" } },
            { attribute: "a1", condition: { operator: "as", value: "v3" } },
            { attribute: "a1", condition: { operator: "undefined" } },
        ]
        stateMachines[0].transitions = [
            {
                id: "001",
                states: [{ name: "s3", arguments: [{ name: "a1", condition: { operator: "in", value: ["v1", "v2", "v3"] } }] }],
                trigger: { type: "event", name: "e1", arguments: [{ name: "a2", condition: { operator: "in range", value: "[1, 3]" } }] },
                result: { name: "s2", arguments: [{ name: "a1", condition: { operator: "=", value: "v2" } }] },
            },
        ]

        assert.doesNotThrow(() => validateStateMachines(stateMachines))
    })
})



