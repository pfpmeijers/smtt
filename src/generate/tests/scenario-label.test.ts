import { assertContains, assertMatchesReference, assertNotContains, createFeatures, test, } from "./utils"
import { type StateMachines, validateStateMachines } from "../../parse"

test("[TST-059] → [REQ-009/010/011/012/451/452]: Scenario label is the transition id and description", () => {
    const stateMachines: StateMachines = [{
        name: "m",
        states: [{name: "s1"}, {name: "s2"}],
        defaultPreconditions: [{state: "s3"}],
        transitions: [{
            id: "001",
            states: [{name: "s1"}],
            trigger: {type: "event", name: "e"},
            result: {name: "s2"},
            notes: "Cart hold expires",
        }],
    }, {
        name: "m0",
        states: [{name: "s3"}]
    }]
    validateStateMachines(stateMachines)
    const feature = createFeatures(stateMachines)["m"]
    assertContains(feature, "Scenario: [001] Cart hold expires\n")
    assertNotContains(feature, "→")
    assertNotContains(feature, "; when")
    assertMatchesReference(stateMachines, feature)
})

test("[TST-060] → [REQ-452]: Scenario label description keeps its casing and placeholders", () => {
    const stateMachines: StateMachines = [{
        name: "m",
        states: [{name: "s1"}, {name: "s2"}],
        dataValueCombinations: [{"a": "A"}],
        transitions: [{
            id: "001",
            states: [{name: "s1"}],
            trigger: {type: "event", name: "e",
                arguments: [{qualifier: "with", name: "a", condition: {operator: "=", value: "A"}}]},
            result: {name: "s2"},
            notes: "Item Added With <a>",
        }],
    }]
    validateStateMachines(stateMachines)
    const feature = createFeatures(stateMachines)["m"]
    assertContains(feature, "Scenario Outline: [001] Item Added With <a>\n")
    assertMatchesReference(stateMachines, feature)
})

test("[TST-061] → [REQ-453]: Scenario label omits the description when the transition has no notes", () => {
    const stateMachines: StateMachines = [{
        name: "m",
        states: [{name: "s1"}, {name: "s2"}],
        transitions: [{
            id: "001",
            states: [{name: "s1"}],
            trigger: {type: "event", name: "e"},
            result: {name: "s2"},
        }],
    }]
    validateStateMachines(stateMachines)
    const feature = createFeatures(stateMachines)["m"]
    assertContains(feature, "  Scenario: [001]\n")
    assertMatchesReference(stateMachines, feature)
})
