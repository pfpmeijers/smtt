import { assertContains, assertNotContains, assertMatchesReference, createFeatures, test, } from "./utils"
import { type StateMachines, validateStateMachines } from "../../parse"

test("[TST-026] → [REQ-148/165/166/167]: Implied conditions on a precondition state filter the examples table", () => {
    const stateMachines: StateMachines = [{
        name: "m",
        states: [{
            name: "s",
            // Implied condition retrieved from the state definition (REQ-165/166/167)
            // and applied as an example-row filter because `s` is a precondition.
            impliedConditions: [{attribute: "a", condition: {operator: ">", value: "5"}}],
        }],
        dataExampleValues: [{a: "1"}, {a: "9"}],
        transitions: [{
            states: [{name: "s", arguments: [{name: "a"}]}],
            trigger: {type: "event", name: "e"},
            result: {name: "s"},
            notes: "",
        }],
    }]
    validateStateMachines(stateMachines)
    const feature = createFeatures(stateMachines)["m"]
    assertContains(feature, "| 9")
    assertNotContains(feature, "| 1")
    assertMatchesReference(stateMachines, feature)
})

test("[TST-027] → [REQ-166]: Implied condition on an attribute absent from the examples imposes no filter", () => {
    const stateMachines: StateMachines = [{
        name: "m",
        states: [{
            name: "s",
            // Attribute `b` is not a column in the examples table → no filter (REQ-166).
            impliedConditions: [{attribute: "b", condition: {operator: ">", value: "5"}}],
        }],
        dataExampleValues: [{a: "1"}, {a: "9"}],
        transitions: [{
            states: [{name: "s", arguments: [{name: "a"}]}],
            trigger: {type: "event", name: "e"},
            result: {name: "s"},
            notes: "",
        }],
    }]
    validateStateMachines(stateMachines)
    const feature = createFeatures(stateMachines)["m"]
    assertContains(feature, "| 1")
    assertContains(feature, "| 9")
    assertMatchesReference(stateMachines, feature)
})

