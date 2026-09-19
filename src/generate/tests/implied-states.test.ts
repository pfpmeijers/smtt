import { strict as assert } from "node:assert"

import { assertContains, assertNotContains, createFeatures, test } from "./utils"
import { annotateImpliedStates, type StateMachines, validateStateMachines } from "../../parse"

/**
 * `m1` holds a session-like pair (s1, s2). `m2` reaches `s4` from either of them (e3 from s1, e4
 * from s2). The root machine `m3` waits for `s4`, so its own preconditions decide which of the two
 * paths explains it.
 */
function buildMachines(root: Partial<StateMachines[number]>, s5Implies?: string[]): StateMachines {
    return [{
        name: "m1",
        states: [{name: "s1"}, {name: "s2"}],
        transitions: [
            {id: "001", states: [{name: "s1"}], trigger: {type: "event", name: "e1"}, result: {name: "s2"}},
            {id: "002", states: [{name: "s2"}], trigger: {type: "event", name: "e2"}, result: {name: "s1"}},
        ],
    }, {
        name: "m2",
        states: [{name: "s3"}, {name: "s4"}],
        transitions: [
            {id: "003", states: [{name: "s1"}], trigger: {type: "event", name: "e3"}, result: {name: "s4"}},
            {id: "004", states: [{name: "s2"}], trigger: {type: "event", name: "e4"}, result: {name: "s4"}},
        ],
    }, {
        name: "m3",
        states: [{name: "s5", ...(s5Implies ? {impliedStates: s5Implies} : {})}, {name: "s6"}],
        transitions: [
            {id: "005", states: [{name: "s5"}], trigger: {type: "state", name: "s4"}, result: {name: "s6"}},
        ],
        ...root,
    }]
}

test("[TST-253] → [REQ-455]: Without a default both expansion paths are generated", () => {
    const machines = buildMachines({})
    validateStateMachines(machines)
    const feature = createFeatures(machines)["m3"]
    assertContains(feature, "When e3")
    assertContains(feature, "When e4")
})

test("[TST-254] → [REQ-455]: A default precondition prunes the expansion paths that contradict it", () => {
    const machines = buildMachines({defaultPreconditions: [{state: "s2"}]})
    validateStateMachines(machines)
    const feature = createFeatures(machines)["m3"]
    assertContains(feature, "When e4")
    assertNotContains(feature, "When e3")
    assertNotContains(feature, "initially s1")
})

test("[TST-255] → [REQ-458]: An implied state prunes the expansion paths that contradict it", () => {
    const machines = buildMachines({}, ["s2"])
    validateStateMachines(machines)
    const feature = createFeatures(machines)["m3"]
    assertContains(feature, "When e4")
    assertNotContains(feature, "When e3")
    assertContains(feature, "Given initially s2\n    And initially s5")
})

test("[TST-256] → [REQ-458]: An implied state overrides the default precondition of its own machine", () => {
    const machines = buildMachines({defaultPreconditions: [{state: "s1"}]}, ["s2"])
    validateStateMachines(machines)
    const feature = createFeatures(machines)["m3"]
    assertNotContains(feature, "initially s1")
    assertContains(feature, "initially s2")
    assertContains(feature, "When e4")
})

test("[TST-257] → [REQ-456]: Implied states are resolved transitively, foundation first", () => {
    const machines: StateMachines = [{
        name: "m1",
        states: [{name: "s1", impliedStates: ["s3"]}, {name: "s2"}],
        transitions: [{id: "001", states: [{name: "s1"}], trigger: {type: "event", name: "e1"}, result: {name: "s2"}}],
    }, {
        name: "m2",
        states: [{name: "s3", impliedStates: ["s5"]}, {name: "s4"}],
        transitions: [{id: "002", states: [{name: "s3"}], trigger: {type: "event", name: "e2"}, result: {name: "s4"}}],
    }, {
        name: "m3",
        states: [{name: "s5"}, {name: "s6"}],
        transitions: [{id: "003", states: [{name: "s5"}], trigger: {type: "event", name: "e3"}, result: {name: "s6"}}],
    }]
    validateStateMachines(machines)
    annotateImpliedStates(machines)
    assert.deepEqual(machines[0].transitions?.[0].impliedStates, [{name: "s5", by: "s1"}, {name: "s3", by: "s1"}])
    assert.deepEqual(machines[1].transitions?.[0].impliedStates, [{name: "s5", by: "s3"}])
    assert.equal(machines[2].transitions?.[0].impliedStates, undefined)
    assertContains(createFeatures(machines)["m1"], "Given initially s5\n    And initially s3\n    And initially s1")
})

test("[TST-258] → [REQ-456]: A state the transition names itself stands for its machine", () => {
    const machines: StateMachines = [{
        name: "m1",
        states: [{name: "s1", impliedStates: ["s3"]}, {name: "s2"}],
        transitions: [{
            id: "001", states: [{name: "s1"}, {name: "s3"}], trigger: {type: "event", name: "e1"}, result: {name: "s2"},
        }],
    }, {
        name: "m2",
        states: [{name: "s3"}, {name: "s4"}],
        transitions: [{id: "002", states: [{name: "s3"}], trigger: {type: "event", name: "e2"}, result: {name: "s4"}}],
    }]
    validateStateMachines(machines)
    annotateImpliedStates(machines)
    assert.equal(machines[0].transitions?.[0].impliedStates, undefined)
})

test("[TST-265] → [REQ-458]: Implied states sit right before the state implying them", () => {
    const machines: StateMachines = [{
        name: "m1",
        states: [{name: "s1", impliedStates: ["s3"]}, {name: "s2"}],
        transitions: [{
            id: "001", states: [{name: "s7"}, {name: "s1"}, {name: "s8"}],
            trigger: {type: "event", name: "e1"}, result: {name: "s2"},
        }],
    }, {
        name: "m2",
        states: [{name: "s3"}, {name: "s4"}],
        transitions: [{id: "002", states: [{name: "s3"}], trigger: {type: "event", name: "e2"}, result: {name: "s4"}}],
    }, {
        name: "m3",
        states: [{name: "s7"}, {name: "s9"}],
        transitions: [{id: "003", states: [{name: "s7"}], trigger: {type: "event", name: "e3"}, result: {name: "s9"}}],
    }, {
        name: "m4",
        states: [{name: "s8"}, {name: "s10"}],
        transitions: [{id: "004", states: [{name: "s8"}], trigger: {type: "event", name: "e4"}, result: {name: "s10"}}],
    }]
    validateStateMachines(machines)
    annotateImpliedStates(machines)
    assertContains(
        createFeatures(machines)["m1"],
        "Given initially s7\n    And initially s3\n    And initially s1\n    And initially s8",
    )
})

test("[TST-266] → [REQ-458]: An implied state standing in for a default takes the default's place", () => {
    const machines: StateMachines = [{
        name: "m1",
        states: [{name: "s1", impliedStates: ["s3"]}, {name: "s2"}],
        transitions: [{id: "001", states: [{name: "s1"}], trigger: {type: "event", name: "e1"}, result: {name: "s2"}}],
    }, {
        name: "m2",
        states: [{name: "s3"}, {name: "s4"}],
        transitions: [{id: "002", states: [{name: "s3"}], trigger: {type: "event", name: "e2"}, result: {name: "s4"}}],
    }, {
        name: "m3",
        states: [{name: "s5"}, {name: "s6"}],
        defaultPreconditions: [{state: "s4"}],
        transitions: [{id: "003", states: [{name: "s1"}], trigger: {type: "event", name: "e3"}, result: {name: "s6"}}],
    }]
    validateStateMachines(machines)
    annotateImpliedStates(machines)
    const feature = createFeatures(machines)["m3"]
    assertNotContains(feature, "initially s4")
    // s3 stands in for the default s4 at the front, ahead of m3's own implied initial state s5.
    assertContains(feature, "Given initially s3\n    And initially s5\n    And initially s1")
})
