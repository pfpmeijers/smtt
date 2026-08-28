import { assertContains, assertNotContains, assertMatchesReference, createFeatures, test, } from "./utils"
import { type StateMachines, validateStateMachines } from "../../parse"

test("[TST-029] → [REQ-147]: Impossible and irrelevant sections are ignored", () => {
    const stateMachines: StateMachines = [{
        name: "m",
        states: [{name: "s"}],
        transitions: [{
            states: [{name: "s"}],
            trigger: {type: "event", name: "e1"},
            result: {name: "s"},
            notes: "",
        }],
        impossible: {defined: [{states: ["s"], trigger: {type: "event", name: "e2"}}]},
        irrelevant: [{states: ["s"], trigger: {type: "event", name: "e3"}}],
    }]
    validateStateMachines(stateMachines)
    const feature = createFeatures(stateMachines)["m"]
    assertContains(feature, "e1")
    assertNotContains(feature, "e2")
    assertNotContains(feature, "e3")
    assertMatchesReference(stateMachines, feature)
})

test("[TST-030] → [REQ-149]: Metadata fields (source path/line) are not used in generation", () => {
    const stateMachines: StateMachines = [{
        name: "m",
        source: "/some/secret/path.md",
        states: [{name: "s", sourceLine: 42}],
        transitions: [{
            states: [{name: "s"}],
            trigger: {type: "event", name: "e"},
            result: {name: "s"},
            notes: "",
            sourceLine: 7,
        }],
    }]
    validateStateMachines(stateMachines)
    const feature = createFeatures(stateMachines)["m"]
    assertNotContains(feature, "secret")
    assertMatchesReference(stateMachines, feature)
})


