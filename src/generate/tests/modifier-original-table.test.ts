import { assertContains, assertMatchesReference, createFeatures, test, } from "./utils"
import { type StateMachines, validateStateMachines } from "../../parse"

test("[TST-046] → [REQ-158]: 'next' modifier derives position from the original unfiltered table", () => {
    const stateMachines: StateMachines = [{
        name: "m",
        states: [{name: "s"}],
        dataExampleValues: [{a: "a0"}, {a: "a1"}, {a: "a2"}],
        transitions: [{
            states: [{name: "s", arguments: [{name: "a", condition: {operator: "not as", value: "a0"}}]}],
            trigger: {type: "event", name: "e", arguments: [{modifier: "next", name: "a"}]},
            result: {name: "s"},
            notes: "",
        }],
    }]
    validateStateMachines(stateMachines)
    const feature = createFeatures(stateMachines)["m"]
    assertContains(feature, "next a")
    // The surviving row a2 wraps to a0, which is only present in the original (pre-filter) table.
    assertContains(feature, "a0")
    assertMatchesReference(stateMachines, feature)
})


