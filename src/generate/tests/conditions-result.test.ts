import { assertContains, assertMatchesReference, assertThrowMatchesReference, createFeatures, test, } from "./utils"
import { type StateMachines, validateStateMachines } from "../../parse"

test("[TST-016] → [REQ-066/088/101]: Result condition adds resulting column", () => {
    const stateMachines: StateMachines = [{
        name: "m",
        states: [{name: "s"}],
        dataExampleValues: [{a: "1"}],
        transitions: [{
            states: [{name: "s", arguments: [{name: "a", condition: {operator: "=", value: "1"}}]}],
            trigger: {type: "event", name: "e"},
            result: {name: "s", arguments: [{name: "a", condition: {operator: "=", value: "2"}}]},
            notes: "",
        }],
    }]
    validateStateMachines(stateMachines)
    const feature = createFeatures(stateMachines)["m"]
    assertContains(feature, "      | a | resulting a |\n      | 1 | 2           |")
    assertMatchesReference(stateMachines, feature)
})

test("[TST-017] → [REQ-089]: Result conditions with equality operator", () => {
    const stateMachines: StateMachines = [{
        name: "m",
        states: [{name: "s"}],
        dataExampleValues: [{a: "1"}, {a: "2"}, {a: "3"}],
        transitions: [{
            trigger: {type: "event", name: "e"},
            result: {name: "s", arguments: [{name: "a", condition: {operator: "as", value: "2"}}]}
        }],
    }]
    validateStateMachines(stateMachines)
    const feature = createFeatures(stateMachines)["m"]
    // Every `resulting a` cell carries the literal condition value `2`, regardless of the operator (`as`).
    assertContains(feature, 
        "      | a | resulting a |\n" + 
        "      | 1 | 2           |\n" +
        "      | 2 | 2           |\n" +
        "      | 3 | 2           |\n")
    assertMatchesReference(stateMachines, feature)
})

test("[TST-086] → [REQ-089]: Result conditions shall be restricted to equality operators only", () => {
    const stateMachines: StateMachines = [{
        name: "m",
        states: [{name: "s"}],
        dataExampleValues: [{a: "1"}],
        transitions: [{
            trigger: {type: "event", name: "e"},
            result: {name: "s", arguments: [{name: "a", condition: {operator: "not as", value: "2"}}]}
        }],
    }]
    assertThrowMatchesReference(stateMachines, () => createFeatures(stateMachines),
        "Invalid result condition for attribute \"a\": operator \"not as\" is not supported. " +
        "Result conditions only allow \"=\" or \"as\" (REQ-089).")
})
