import { assertContains, assertMatchesReference, createFeatures, test, } from "./utils"
import { type StateMachines, validateStateMachines } from "../../parse"

test("[TST-016] → [REQ-066/088/101]: Result value adds resulting column", () => {
    const stateMachines: StateMachines = [{
        name: "m",
        states: [{name: "s"}],
        dataExampleValues: [{a: "1"}, {a: "2"}],
        transitions: [{
            states: [{name: "s", arguments: [{name: "a", condition: {operator: "=", value: "1"}}]}],
            trigger: {type: "event", name: "e"},
            result: {name: "s", arguments: [{name: "a", result: {value: "2"}}]},
            notes: "",
        }],
    }]
    validateStateMachines(stateMachines)
    const feature = createFeatures(stateMachines)["m"]
    assertContains(feature, "      | a | resulting a |\n      | 1 | 2           |")
    assertMatchesReference(stateMachines, feature)
})

test("[TST-017] → [REQ-089]: Attribute result values are always used for assignment", () => {
    const stateMachines: StateMachines = [{
        name: "m",
        states: [{name: "s"}],
        dataExampleValues: [{a: "1"}, {a: "2"}, {a: "3"}],
        transitions: [{
            trigger: {type: "event", name: "e"},
            result: {name: "s", arguments: [{name: "a", result: {value: "2"}}]}
        }],
    }]
    validateStateMachines(stateMachines)
    const feature = createFeatures(stateMachines)["m"]
    // `a` is never referenced as a base placeholder (a result value always renders as
    // `<resulting a>`), so its column is dropped and the rows collapse to the one distinct
    // `resulting a` value, `2`.
    assertContains(feature,
        "      | resulting a |\n" +
        "      | 2           |\n")
    assertMatchesReference(stateMachines, feature)
})

test("[TST-108] → [REQ-169]: Result value attribute with no other reference drops its base column", () => {
    const stateMachines: StateMachines = [{
        name: "m",
        states: [{name: "s"}],
        dataExampleValues: [{a1: "x", a2: "1"}, {a1: "y", a2: "2"}],
        transitions: [{
            trigger: {type: "event", name: "e"},
            result: {name: "s", arguments: [{name: "a1"}, {name: "a2", result: {value: "2"}}]},
        }],
    }]
    validateStateMachines(stateMachines)
    const feature = createFeatures(stateMachines)["m"]
    // `a2` is only ever referenced via the result value — always rendered as `<resulting a2>`
    // — so its base column is dropped. `a1` is a plain result reference (no result value), so it
    // does render as `<a1>` and keeps its base column.
    assertContains(feature,
        "      | a1 | resulting a2 |\n" +
        "      | x  | 2            |\n" +
        "      | y  | 2            |\n")
    assertMatchesReference(stateMachines, feature)
})

test("[TST-109] → [REQ-423]: Result value referencing another attribute resolves dynamically per row", () => {
    const stateMachines: StateMachines = [{
        name: "m",
        states: [{name: "s"}],
        dataExampleValues: [{a: "1"}, {a: "2"}],
        transitions: [{
            states: [{name: "s", arguments: [{name: "a"}]}],
            trigger: {type: "event", name: "e"},
            result: {name: "s", arguments: [{name: "b", result: {value: "a", valueIsReference: true}}]},
            notes: "",
        }],
    }]
    validateStateMachines(stateMachines)
    const feature = createFeatures(stateMachines)["m"]
    // `resulting b` tracks each row's own `a` value dynamically, rather than one fixed literal.
    assertContains(feature,
        "      | a | resulting b |\n" +
        "      | 1 | 1           |\n" +
        "      | 2 | 2           |\n")
    assertMatchesReference(stateMachines, feature)
})
