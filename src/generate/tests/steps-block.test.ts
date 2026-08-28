import {
    assertContains,
    assertMatchesReference,
    assertNoBlankLineBetween,
    assertNotContains,
    createFeatures,
    test,
} from "./utils"
import { type StateMachines, validateStateMachines } from "../../parse"

test("[TST-079] → [REQ-032/035/038/039/044]: Given steps use Given then And keywords", () => {
    const stateMachines: StateMachines = [{
        name: "m",
        states: [{name: "s1"}],
        defaultPreconditions: [{state: "s2"}],
        transitions: [{
            states: [{name: "s1"}],
            trigger: {type: "event", name: "e"},
            result: {name: "s1"},
        }],
    }, {
        name: "m2",
        states: [{name: "s2"}]
    }]
    validateStateMachines(stateMachines)
    const feature = createFeatures(stateMachines)["m"]
    assertContains(
        feature,
        "    Given initially s2\n" +
        "    And initially s1"
    )
    assertMatchesReference(stateMachines, feature)
})

test("[TST-080] → [REQ-036]: Default precondition skipped when transition already mentions a state from the same state machine", () => {
    const stateMachines: StateMachines = [{
        name: "m",
        states: [{name: "s1"}, {name: "s2"}],
        defaultPreconditions: [{state: "s2"}],
        transitions: [{
            states: [{name: "s1"}],
            trigger: {type: "event", name: "e"},
            result: {name: "s2"},
        }],
    }]
    validateStateMachines(stateMachines)
    const feature = createFeatures(stateMachines)["m"]
    assertNotContains(feature, "Given initially s2")
    assertMatchesReference(stateMachines, feature)
})

test("[TST-081] → [REQ-036]: Default precondition injected when no overlap with owning state machine", () => {
    const stateMachines: StateMachines = [{
        name: "m",
        states: [{name: "s1"}],
        defaultPreconditions: [{state: "s2"}],
        transitions: [{
                        trigger: {type: "event", name: "e"},
            result: {name: "s1"},
        }],
    }, {
        name: "m2",
        states: [{name: "s2"}]
    }]
    validateStateMachines(stateMachines)
    const feature = createFeatures(stateMachines)["m"]
    assertContains(feature, "Given initially s2")
    assertMatchesReference(stateMachines, feature)
})

test("[TST-082] → [REQ-040/041]: When step from event trigger", () => {
    const stateMachines: StateMachines = [{
        name: "m",
        states: [{name: "s"}],
        transitions: [{
            states: [{name: "s"}],
            trigger: {type: "event", name: "e"},
            result: {name: "s"},
        }],
    }]
    validateStateMachines(stateMachines)
    const feature = createFeatures(stateMachines)["m"]
    assertContains(feature, "When e")
    assertMatchesReference(stateMachines, feature)
})

test("[TST-083] → [REQ-042/043/044]: Then step with result state", () => {
    const stateMachines: StateMachines = [{
        name: "m",
        states: [{name: "s"}],
        transitions: [{
            states: [{name: "s"}],
            trigger: {type: "event", name: "e"},
            result: {name: "s"},
        }],
    }]
    validateStateMachines(stateMachines)
    const feature = createFeatures(stateMachines)["m"]
    assertContains(feature, "Then expect s")
    assertMatchesReference(stateMachines, feature)
})

test("[TST-084] → [REQ-045/046]: Notes appended after last Then", () => {
    const stateMachines: StateMachines = [{
        name: "m",
        states: [{name: "s"}],
        transitions: [{
            states: [{name: "s"}],
            trigger: {type: "event", name: "e"},
            result: {name: "s"},
            notes: "...",
        }],
    }]
    validateStateMachines(stateMachines)
    const feature = createFeatures(stateMachines)["m"]
    assertContains(
        feature,
        "  # Notes: ..."
    )
    assertNoBlankLineBetween(feature, "Then expect s", "# Notes:")
    assertMatchesReference(stateMachines, feature)
})

test("[TST-085] → [REQ-045]: Notes omitted when not defined", () => {
    const stateMachines: StateMachines = [{
        name: "m",
        states: [{name: "s"}],
        transitions: [{
            states: [{name: "s"}],
            trigger: {type: "event", name: "e"},
            result: {name: "s"},
        }],
    }]
    validateStateMachines(stateMachines)
    const feature = createFeatures(stateMachines)["m"]
    assertNotContains(feature, "# Notes:")
    assertMatchesReference(stateMachines, feature)
})
