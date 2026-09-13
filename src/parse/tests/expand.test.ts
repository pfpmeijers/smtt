/**
 * Tests for the expansion annotation step (`expand.ts`).
 *
 * Covers:
 *  - Which transitions carry an annotation, and which are left without one.
 *  - The chain order and the references it records.
 *  - A state trigger that nothing explains.
 */

import { describe, it } from "node:test"
import * as assert from "node:assert/strict"

import type { StateMachine } from "../sm.ast.d"
import { annotateExpansions } from "../expand"

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
