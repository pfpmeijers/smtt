import { assertContains, assertMatchesReference, createFeatures, test, } from "./utils"
import { type StateMachines, validateStateMachines } from "../../parse"

test("[TST-057] → [REQ-064/151]: Examples table columns in first-encounter order", () => {
    const stateMachines: StateMachines = [{
        name: "m",
        states: [{name: "s1"}],
        dataExampleValues: [
            {b4: "1", b3: "2", b2: "3", b1: "4"},
        ],
        defaultPreconditions: [{
            state: "s2",
            arguments: [{name: "a1"}],
        }],
        transitions: [{
            states: [{name: "s1", arguments: [{name: "b1"}]}],
            trigger: {type: "event", name: "e", arguments: [{name: "b2"}]},
            result: {name: "s1", arguments: [{name: "b3"}]},
            notes: "",
        }],
    }, {
        name: "m0",
        states: [{name: "s2"}]
    }]
    validateStateMachines(stateMachines)
    const feature = createFeatures(stateMachines)["m"]
    assertContains(feature, "| a1 | b1 | b2 | b3 |")
    assertMatchesReference(stateMachines, feature)
})

test("[TST-058] → [REQ-063/067/068]: Examples table rows from dataExampleValues", () => {
    const stateMachines: StateMachines = [{
        name: "m",
        states: [{name: "s"}],
        dataExampleValues: [{"a": "1"}],
        transitions: [{
            states: [{name: "s", arguments: [{qualifier: "as", name: "a"}]}],
            trigger: {type: "event", name: "e"},
            result: {name: "s"},
            notes: "",
        }],
    }]
    validateStateMachines(stateMachines)
    const feature = createFeatures(stateMachines)["m"]
    assertContains(feature, "      | a |\n      | 1 |")
    assertMatchesReference(stateMachines, feature)
})
