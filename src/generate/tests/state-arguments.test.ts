import { assertContains, assertMatchesReference, createFeatures, test, } from "./utils"
import { type StateMachines, validateStateMachines } from "../../parse"

test("[TST-063] → [REQ-050]: Multiple arguments appended comma separated in order", () => {
    const stateMachines: StateMachines = [{
        name: "m",
        states: [{name: "s"}],
        dataExampleValues: [{a: "1", b: "2"}],
        transitions: [{
            states: [{name: "s", arguments: [{name: "a"}, {name: "b"}]}],
            trigger: {type: "event", name: "e"},
            result: {name: "s"},
            notes: "",
        }],
    }]
    validateStateMachines(stateMachines)
    const feature = createFeatures(stateMachines)["m"]
    assertContains(feature, "\"<a>\", \"<b>\"")
    assertMatchesReference(stateMachines, feature)
})

test("[TST-064] → [REQ-051/052]: preQualifier rendered before modifier", () => {
    const stateMachines: StateMachines = [{
        name: "m",
        states: [{name: "s"}],
        dataExampleValues: [{a: "1"}, {a: "2"}],
        transitions: [{
            states: [{name: "s", arguments: [{name: "a"}]}],
            trigger: {type: "event", name: "e"},
            result: {name: "s", arguments: [{preQualifier: "under", modifier: "different", name: "a"}]},
            notes: "",
        }],
    }]
    validateStateMachines(stateMachines)
    const feature = createFeatures(stateMachines)["m"]
    assertContains(feature, "under \"<different a>\"")
    assertMatchesReference(stateMachines, feature)
})

test("[TST-065] → [REQ-055/056]: postQualifier rendered after modifier", () => {
    const stateMachines: StateMachines = [{
        name: "m",
        states: [{name: "s"}],
        dataExampleValues: [{a: "1"}, {a: "2"}],
        transitions: [{
            states: [{name: "s", arguments: [{name: "a"}]}],
            trigger: {type: "event", name: "e"},
            result: {name: "s", arguments: [{modifier: "different", postQualifier: "from", name: "a"}]},
            notes: "",
        }],
    }]
    validateStateMachines(stateMachines)
    const feature = createFeatures(stateMachines)["m"]
    assertContains(feature, "\"<different a>\" from")
    assertMatchesReference(stateMachines, feature)
})

test("[TST-066] → [REQ-059/060]: suffix rendered after attribute name", () => {
    const stateMachines: StateMachines = [{
        name: "m",
        states: [{name: "s"}],
        dataExampleValues: [{a: "1"}],
        transitions: [{
            states: [{name: "s", arguments: [{qualifier: "with", name: "a", suffix: "prefilled"}]}],
            trigger: {type: "event", name: "e"},
            result: {name: "s"},
            notes: "",
        }],
    }]
    validateStateMachines(stateMachines)
    const feature = createFeatures(stateMachines)["m"]
    assertContains(feature, "prefilled")
    assertMatchesReference(stateMachines, feature)
})

