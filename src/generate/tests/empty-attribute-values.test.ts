import {
    assertContains,
    assertMatchesReference,
    assertNotContains,
    assertThrowMatchesReference,
    createFeatures,
    test,
} from "./utils"
import { type StateMachines, validateStateMachines } from "../../parse"

test("[TST-019] → [REQ-073/074/075]: Empty string in dataExampleValues treated as undefined", () => {
    const stateMachines: StateMachines = [{
        name: "m",
        states: [{name: "s"}],
        dataExampleValues: [{a: "1"}, {a: ""}],
        transitions: [{
            states: [{name: "s", arguments: [{name: "a", condition: {operator: "=", value: "1"}}]}],
            trigger: {type: "event", name: "e"},
            result: {name: "s"},
            notes: "",
        }],
    }]
    validateStateMachines(stateMachines)
    const feature = createFeatures(stateMachines)["m"]
    assertContains(feature, "| 1 |")
    assertNotContains(feature, "|  |")
    assertMatchesReference(stateMachines, feature)
})

test("[TST-020] → [REQ-073/074/075]: Empty string matches undefined operator", () => {
    const stateMachines: StateMachines = [{
        name: "m",
        states: [{name: "s"}],
        dataExampleValues: [{a: ""}, {a: "1"}],
        transitions: [{
            states: [{name: "s", arguments: [{name: "a", condition: {operator: "undefined"}}]}],
            trigger: {type: "event", name: "e"},
            result: {name: "s"},
            notes: "",
        }],
    }]
    validateStateMachines(stateMachines)
    const feature = createFeatures(stateMachines)["m"]
    assertContains(feature, "|   |")
    assertNotContains(feature, "| 1 |")
    assertMatchesReference(stateMachines, feature)
})

test("[TST-021] → [REQ-073/074]: Empty string in modifier lookup is treated as undefined", () => {
    const stateMachines: StateMachines = [{
        name: "m",
        states: [{name: "s"}],
        dataExampleValues: [{a: "1"}],
        dataOtherValues: [{a: ""}],
        transitions: [{
            states: [{name: "s", arguments: [{name: "a"}]}],
            trigger: {type: "event", name: "e", arguments: [{modifier: "different", name: "a"}]},
            result: {name: "s"},
            notes: "",
        }],
    }]
    validateStateMachines(stateMachines)
    const feature = createFeatures(stateMachines)["m"]
    assertContains(feature, "| 1 |             |")
    assertMatchesReference(stateMachines, feature)
})

test("[TST-022] → [REQ-157]: Arguments referenced with no dataExampleValues table raises error", () => {
    const stateMachines: StateMachines = [{
        name: "m",
        states: [{name: "s"}],
        transitions: [{
            states: [{name: "s", arguments: [{name: "a"}]}],
            trigger: {type: "event", name: "e"},
            result: {name: "s"},
        }],
    }]
    assertThrowMatchesReference(stateMachines, () => createFeatures(stateMachines),
        "Invalid state machine \"m\": anonymous transition references argument(s), " +
        "but the state machine's dataExampleValues table is empty or absent (REQ-157/REQ-163).",
    )
})

