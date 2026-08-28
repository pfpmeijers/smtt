import { assertContains, assertMatchesReference, createFeatures, test, } from "./utils"
import { type StateMachines, validateStateMachines } from "../../parse"

test("[TST-018] → [REQ-156]: Default precondition modifier references a base value in the transition", () => {
    const stateMachines: StateMachines = [
        {
            name: "m1",
            states: [{name: "s1"}]
        },
        {
            name: "m2",
            states: [{name: "s2"}],
            dataExampleValues: [{count: "1"}, {count: "2"}],
            defaultPreconditions: [{state: "s1", arguments: [{modifier: "incremented", name: "count"}]}],
            transitions: [{
                states: [{name: "s2", arguments: [{name: "count"}]}],
                trigger: {type: "event", name: "e"},
                result: {name: "s2"},
                notes: "",
            }],
        },
    ]
    validateStateMachines(stateMachines)
    const feature = createFeatures(stateMachines)["m2"]
    assertContains(feature, "initially s1")
    assertContains(feature, "initially s2")
    assertContains(feature, "| count |")
    assertContains(feature, "| incremented count |")
    assertMatchesReference(stateMachines, feature)
})

