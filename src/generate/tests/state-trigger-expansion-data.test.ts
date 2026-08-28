import { assertContains, assertNotContains, assertMatchesReference, createFeatures, test, } from "./utils"
import { type StateMachines, validateStateMachines } from "../../parse"

test("[TST-069] → [REQ-161]: Expanded state trigger uses the combined data table of the chain", () => {
    const stateMachines: StateMachines = [
        {
            name: "m1",
            states: [{name: "s1"}, {name: "s2"}],
            dataExampleValues: [{a1: "1"}, {a1: "2"}],
            transitions: [{
                trigger: {
                    type: "event",
                    name: "e",
                    arguments: [{name: "a1"}],
                },
                result: {name: "s2"}
            }],
        },
        {
            name: "m2",
            states: [{name: "s3"}],
            dataExampleValues: [{a2: "3"}, {a2: "4"}],
            transitions: [{
                trigger: {type: "state", name: "s2", arguments: [{name: "a1"}]},
                result: {name: "s3", arguments: [{name: "a2"}]}
            }],
        },
    ]
    validateStateMachines(stateMachines)
    const feature = createFeatures(stateMachines)["m2"]
    assertContains(feature, "e")
    assertContains(feature, "a")
    assertContains(feature, "1")
    assertMatchesReference(stateMachines, feature)
})

test("[TST-070] → [REQ-162]: Conditions across an expansion chain merge as a conjunction", () => {
    const stateMachines: StateMachines = [
        {
            name: "m1",
            states: [{name: "s1"}, {name: "s2"}],
            dataExampleValues: [{a: "1"}, {a: "2"}],
            transitions: [{
                states: [{name: "s1"}],
                trigger: {
                    type: "event",
                    name: "e",
                    // Source-transition condition; must combine with the top-level transition.
                    arguments: [{qualifier: "with", name: "a", condition: {operator: "as", value: "1"}}],
                },
                result: {name: "s2", arguments: [{qualifier: "as", name: "a"}]},
                notes: "",
            }],
        },
        {
            name: "m2",
            states: [{name: "s3"}, {name: "s4"}],
            dataExampleValues: [{a: "1"}, {a: "2"}],
            transitions: [{
                states: [{name: "s3"}],
                trigger: {type: "state", name: "s2", arguments: [{qualifier: "as", name: "a"}]},
                result: {name: "s4", arguments: [{qualifier: "as", name: "a"}]},
                notes: "",
            }],
        },
    ]
    validateStateMachines(stateMachines)
    const feature = createFeatures(stateMachines)["m2"]
    assertContains(feature, "| 1 |")
    assertNotContains(feature, "| 2 |")
    assertMatchesReference(stateMachines, feature)
})

