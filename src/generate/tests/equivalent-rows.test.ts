import { assertContains, assertMatchesReference, assertNotContains, createFeatures, test } from "./utils"
import { type StateMachines, validateStateMachines } from "../../parse"

test("[TST-224] → [REQ-440]: Rows that only rename values are pruned to the first", () => {
    const stateMachines: StateMachines = [{
        name: "m1",
        states: [{name: "s1"}, {name: "s2"}],
        dataValueCombinations: [
            {a1: "v1", a2: "v3"},
            {a1: "v1", a2: "v4"},
            {a1: "v2", a2: "v3"},
            {a1: "v2", a2: "v4"},
        ],
        transitions: [{
            states: [{name: "s1"}],
            trigger: {type: "event", name: "e", arguments: [{name: "a1"}, {name: "a2"}]},
            result: {name: "s2", arguments: [
                {name: "a3", result: {value: "a1", valueIsReference: true}},
                {name: "a4", result: {value: "a2", valueIsReference: true}},
            ]},
        }],
    }]
    validateStateMachines(stateMachines)
    const feature = createFeatures(stateMachines)["m1"]
    assertContains(feature,
        "      | a1 | a2 | resulting a3 | resulting a4 |\n" +
        "      | v1 | v3 | v1           | v3           |\n")
    assertNotContains(feature, "v2")
    assertNotContains(feature, "v4")
    assertMatchesReference(stateMachines, feature)
})

test("[TST-225] → [REQ-440]: A literal the model names keeps rows apart", () => {
    const stateMachines: StateMachines = [{
        name: "m1",
        states: [{name: "s1"}],
        dataValueCombinations: [
            {a1: "v1", a2: "v1"},
            {a1: "v1", a2: "v2"},
            {a1: "v1", a2: "v3"},
        ],
        transitions: [{
            states: [{name: "s1", arguments: [{name: "a1", condition: {operator: "=", value: "v1"}}]}],
            trigger: {type: "event", name: "e", arguments: [{name: "a2"}]},
            result: {name: "s1"},
        }],
    }]
    validateStateMachines(stateMachines)
    const feature = createFeatures(stateMachines)["m1"]
    // `v1` is significant; `v2` and `v3` are both merely "another value".
    assertContains(feature,
        "      | a1 | a2 |\n" +
        "      | v1 | v1 |\n" +
        "      | v1 | v2 |\n")
    assertNotContains(feature, "v3")
    assertMatchesReference(stateMachines, feature)
})
