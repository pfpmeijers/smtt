import { assertContains, assertMatchesReference, assertThrowMatchesReference, createFeatures, test, } from "./utils"
import { type StateMachines, validateStateMachines } from "../../parse"

test("[TST-016] → [REQ-066/088/101]: Result condition adds resulting column", () => {
    const stateMachines: StateMachines = [{
        name: "m",
        states: [{name: "s"}],
        dataExampleValues: [{a: "1"}, {a: "2"}],
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
    // `a` is never referenced as a base placeholder (the result condition always renders as
    // `<resulting a>`), so its column is dropped and the rows collapse to the one distinct
    // `resulting a` value, `2`, regardless of the operator (`as`).
    assertContains(feature,
        "      | resulting a |\n" +
        "      | 2           |\n")
    assertMatchesReference(stateMachines, feature)
})

test("[TST-108] → [REQ-169]: Result condition attribute with no other reference drops its base column", () => {
    const stateMachines: StateMachines = [{
        name: "m",
        states: [{name: "s"}],
        dataExampleValues: [{a1: "x", a2: "1"}, {a1: "y", a2: "2"}],
        transitions: [{
            trigger: {type: "event", name: "e"},
            result: {name: "s", arguments: [{name: "a1"}, {name: "a2", condition: {operator: "=", value: "2"}}]},
        }],
    }]
    validateStateMachines(stateMachines)
    const feature = createFeatures(stateMachines)["m"]
    // `a2` is only ever referenced via the result condition — always rendered as `<resulting a2>`
    // — so its base column is dropped. `a1` is a plain result reference (no condition), so it does
    // render as `<a1>` and keeps its base column.
    assertContains(feature,
        "      | a1 | resulting a2 |\n" +
        "      | x  | 2            |\n" +
        "      | y  | 2            |\n")
    assertMatchesReference(stateMachines, feature)
})

test("[TST-086] → [REQ-089]: Result conditions shall be restricted to equality operators only", () => {
    const stateMachines: StateMachines = [{
        name: "m",
        states: [{name: "s"}],
        dataExampleValues: [{a: "1"}, {a: "2"}],
        transitions: [{
            trigger: {type: "event", name: "e"},
            result: {name: "s", arguments: [{name: "a", condition: {operator: "not as", value: "2"}}]}
        }],
    }]
    assertThrowMatchesReference(stateMachines, () => createFeatures(stateMachines),
        "State machine `m`: Invalid result condition for attribute `a`: operator `not as` is not supported. " +
        "Result conditions only allow `=`, `as`, or `undefined` (REQ-089).")
})
