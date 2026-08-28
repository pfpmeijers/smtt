import { assertContains, assertNotContains, assertMatchesReference, createFeatures, test, } from "./utils"
import { type StateMachines, validateStateMachines } from "../../parse"

test("[TST-047] → [REQ-142/143/144]: Modifier and condition co-exist; condition filters the derived value", () => {
    const stateMachines: StateMachines = [{
        name: "m",
        states: [{name: "s"}],
        dataExampleValues: [{count: "1"}, {count: "2"}],
        transitions: [{
            states: [{name: "s", arguments: [{name: "count"}]}],
            trigger: {
                type: "event",
                name: "e",
                arguments: [{modifier: "incremented", name: "count", condition: {operator: ">", value: "1"}}],
            },
            result: {name: "s"},
            notes: "",
        }],
    }]
    validateStateMachines(stateMachines)
    const feature = createFeatures(stateMachines)["m"]
    // Derived column exists, and the base row whose derived value fails `> 5` is filtered out.
    assertContains(feature, "incremented count")
    assertNotContains(feature, "| 2 |")
    assertMatchesReference(stateMachines, feature)
})
