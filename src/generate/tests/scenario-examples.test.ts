import * as assert from "node:assert/strict"
import { assertContains, assertMatchesReference, createFeatures, test, } from "./utils"
import { type StateMachines, validateStateMachines } from "../../parse"

test("[TST-057] → [REQ-064/151]: Examples table columns in first-encounter order", () => {
    const stateMachines: StateMachines = [{
        name: "m",
        states: [{name: "s1"}],
        dataValueCombinations: [
            {b4: "1", b3: "2", b2: "3", b1: "4"},
        ],
        defaultPreconditions: [{
            state: "s2",
            arguments: [{name: "a1"}],
        }],
        transitions: [{
            states: [{name: "s1", arguments: [{name: "b1"}]}],
            trigger: {type: "event", name: "e", arguments: [{name: "b2"}]},
            result: {name: "s1", arguments: [{name: "b3"}]},
            notes: "",
        }],
    }, {
        name: "m0",
        states: [{name: "s2"}]
    }]
    validateStateMachines(stateMachines)
    const feature = createFeatures(stateMachines)["m"]
    assertContains(feature, "| a1 | b1 | b2 | b3 |")
    assertMatchesReference(stateMachines, feature)
})

test("[TST-058] → [REQ-063/067/068]: Examples table rows from dataValueCombinations", () => {
    const stateMachines: StateMachines = [{
        name: "m",
        states: [{name: "s"}],
        dataValueCombinations: [{"a": "1"}],
        transitions: [{
            states: [{name: "s", arguments: [{qualifier: "as", name: "a"}]}],
            trigger: {type: "event", name: "e"},
            result: {name: "s"},
            notes: "",
        }],
    }]
    validateStateMachines(stateMachines)
    const feature = createFeatures(stateMachines)["m"]
    assertContains(feature, "      | a |\n      | 1 |")
    assertMatchesReference(stateMachines, feature)
})

test("[TST-100] → [REQ-160]: Examples table removes rendered duplicate rows", () => {
    const stateMachines: StateMachines = [{
        name: "m",
        states: [{name: "s"}],
        dataValueCombinations: [
            {a1: "V1", a2: "0"},
            {a1: "V1", a2: "1"},
            {a1: "V2", a2: "0"},
            {a1: "V2", a2: "1"},
        ],
        transitions: [{
            states: [{name: "s", arguments: [{qualifier: "as", name: "a1"}]}],
            trigger: {type: "event", name: "e"},
            result: {name: "s"},
            notes: "",
        }],
    }]
    validateStateMachines(stateMachines)
    const feature = createFeatures(stateMachines)["m"]
    assertContains(feature, "      | a1 |\n      | V1 |\n      | V2 |")
    assert.ok((feature.match(/\| V1 \|/g) ?? []).length === 1, "duplicate rendered row for V1 must be removed")
    assert.ok((feature.match(/\| V2 \|/g) ?? []).length === 1, "duplicate rendered row for V2 must be removed")
    assertMatchesReference(stateMachines, feature)
})

test("[TST-210] → [REQ-436]: Examples table drops columns not referenced in any step", () => {
    const stateMachines: StateMachines = [{
        name: "m",
        states: [{name: "s1"}],
        dataValueCombinations: [
            {a1: "1", b1: "2"},
            {a1: "3", b1: "2"},
        ],
        defaultPreconditions: [{
            state: "s2",
            arguments: [{name: "a1"}],
        }],
        transitions: [{
            states: [{name: "s1", arguments: [{name: "b1"}]}, {name: "s3"}],
            trigger: {type: "event", name: "e"},
            result: {name: "s1"},
            notes: "",
        }],
    }, {
        name: "m0",
        states: [{name: "s2"}, {name: "s3"}],
    }]
    validateStateMachines(stateMachines)
    const feature = createFeatures(stateMachines)["m"]
    assertContains(feature, "      | b1 |\n      | 2  |\n")
    assert.ok(!feature.includes("a1"), "unreferenced column a1 must be dropped")
    assertMatchesReference(stateMachines, feature)
})
