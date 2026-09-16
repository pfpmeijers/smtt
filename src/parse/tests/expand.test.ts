/**
 * Tests for the expansion annotation step (`expand.ts`).
 *
 * Covers:
 *  - What a state trigger's arguments are bound to by the source resolving it.
 *  - Which transitions carry an annotation, and which are left without one.
 *  - The chain order and the references it records.
 *  - A state trigger that nothing explains.
 */

import { describe, it } from "node:test"
import * as assert from "node:assert/strict"

import type { StateMachine } from "../sm.ast.d"
import { annotateExpansions, bindResult, chainArgumentBindings, triggerArgumentBindings } from "../expand"

/** Two machines: `m1` produces `s2` on an event, `m2` reacts to `s2` with a state trigger. */
function buildChainedMachines(): StateMachine[] {
    return [
        {
            name: "m1",
            states: [{ name: "s1" }, { name: "s2" }],
            transitions: [
                { id: "a", states: [{ name: "s1" }], trigger: { type: "event", name: "e1" }, result: { name: "s2" } },
            ],
        },
        {
            name: "m2",
            states: [{ name: "s3" }, { name: "s4" }],
            transitions: [
                { id: "b", states: [{ name: "s3" }], trigger: { type: "state", name: "s2" }, result: { name: "s4" } },
            ],
        },
    ]
}

describe("annotateExpansions", () => {
    it("[TST-178] → [REQ-431]: records the source chain of a state trigger", () => {
        const stateMachines = buildChainedMachines()
        annotateExpansions(stateMachines)

        assert.deepEqual(stateMachines[1].transitions?.[0].expansion, [
            { sources: [{ stateMachine: "m1", transitionIndex: 0, transitionId: "a" }] },
        ])
    })

    it("[TST-179] → [REQ-431]: leaves an event-triggered transition unannotated", () => {
        const stateMachines = buildChainedMachines()
        annotateExpansions(stateMachines)

        assert.ok(!("expansion" in (stateMachines[0].transitions?.[0] ?? {})))
    })

    it("[TST-180] → [REQ-431]: records a multi-step chain innermost first", () => {
        const stateMachines = buildChainedMachines()
        stateMachines.push({
            name: "m3",
            states: [{ name: "s5" }, { name: "s6" }],
            transitions: [
                { id: "c", states: [{ name: "s5" }], trigger: { type: "state", name: "s4" }, result: { name: "s6" } },
            ],
        })
        annotateExpansions(stateMachines)

        // `sources[0]` carries the event trigger that starts the chain; the last entry produces
        // the state `c`'s own trigger names.
        assert.deepEqual(stateMachines[2].transitions?.[0].expansion, [
            {
                sources: [
                    { stateMachine: "m1", transitionIndex: 0, transitionId: "a" },
                    { stateMachine: "m2", transitionIndex: 0, transitionId: "b" },
                ],
            },
        ])
    })

    it("[TST-181] → [REQ-431]: records an empty list when nothing explains the trigger", () => {
        const stateMachines = buildChainedMachines()
        // No transition results in `s1`, so `m2`'s trigger has no source to resolve to.
        stateMachines[1].transitions![0].trigger = { type: "state", name: "s1" }
        annotateExpansions(stateMachines)

        assert.deepEqual(stateMachines[1].transitions?.[0].expansion, [])
    })

    it("[TST-182] → [REQ-431]: re-annotating replaces a stale annotation", () => {
        const stateMachines = buildChainedMachines()
        stateMachines[1].transitions![0].expansion = [
            { sources: [{ stateMachine: "m1", transitionIndex: 99, transitionId: "gone" }] },
        ]
        annotateExpansions(stateMachines)

        assert.deepEqual(stateMachines[1].transitions?.[0].expansion, [
            { sources: [{ stateMachine: "m1", transitionIndex: 0, transitionId: "a" }] },
        ])
    })
})

describe("trigger argument bindings", () => {
    /** `m1` sets `a` from `b` on an event; `m2` reacts to `s2` with `a` and `b`, and sets `c` from `a`. */
    function buildBindingMachines(): StateMachine[] {
        return [
            {
                name: "m1",
                states: [{ name: "s1" }, { name: "s2" }],
                transitions: [{
                    id: "a",
                    states: [{ name: "s1" }],
                    trigger: { type: "event", name: "e", arguments: [{ name: "b" }] },
                    result: { name: "s2", arguments: [{ name: "a", result: { value: "b", valueIsReference: true } }] },
                }],
            },
            {
                name: "m2",
                states: [{ name: "s3" }, { name: "s4" }],
                transitions: [{
                    id: "b",
                    states: [{ name: "s3" }],
                    trigger: { type: "state", name: "s2", arguments: [{ name: "a" }, { name: "b" }] },
                    result: { name: "s4", arguments: [{ name: "c", result: { value: "a", valueIsReference: true } }] },
                }],
            },
        ]
    }

    it("[TST-212] → [REQ-438]: binds a trigger argument the source's result sets to its resulting column", () => {
        const [m1, m2] = buildBindingMachines()
        const bindings = triggerArgumentBindings(m2.transitions![0].trigger, m1.transitions![0])

        // `b` is only referenced by the source's own trigger, so its value carries over unbound.
        assert.deepEqual([...bindings], [["a", "resulting a"]])
    })

    it("[TST-213] → [REQ-438]: binds each link of a chain through the link before it", () => {
        const [m1, m2] = buildBindingMachines()
        const sourceChain = [{ stateMachineName: "m1", transition: m1.transitions![0], defaultPreconditions: [] }]
        const bindings = chainArgumentBindings(m2.transitions![0], sourceChain)

        assert.equal(bindings.length, 2)
        assert.equal(bindings[0].size, 0)
        assert.deepEqual([...bindings[1]], [["a", "resulting a"]])
    })

    it("[TST-214] → [REQ-438]: a bound result reads the column its reference is bound to", () => {
        const [, m2] = buildBindingMachines()
        const result = m2.transitions![0].result
        const bound = bindResult(result, new Map([["a", "resulting a"]]))

        assert.equal(bound.arguments?.[0].result?.value, "resulting a")
        assert.equal(result.arguments?.[0].result?.value, "a")
        assert.equal(bindResult(result, new Map()), result)
    })
})
