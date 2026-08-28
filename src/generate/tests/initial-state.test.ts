import { assertContains, assertMatchesReference, createFeatures, test, } from "./utils"
import { type StateMachines, validateStateMachines } from "../../parse"

test("[TST-028] → [REQ-133]: Implied initial precondition taken from explicit initialState", () => {
    const stateMachines: StateMachines = [
        {
            name: "m1",
            states: [{name: "s1"}]
        },
        {
            name: "m2",
            states: [{name: "s2"}, {name: "s3"}],
            // First state is "s2", but initialState explicitly overrides it to "s3".
            initialState: "s3",
            transitions: [{
                // No own (machine "m2") state present, so the initial state is implied.
                states: [{name: "s1"}],
                trigger: {type: "event", name: "e2"},
                result: {name: "s3"},
                notes: "",
            }],
        },
    ]
    validateStateMachines(stateMachines)
    const feature = createFeatures(stateMachines)["m2"]
    assertContains(feature, "initially s1")
    assertContains(feature, "initially s3")
    assertMatchesReference(stateMachines, feature)
})

