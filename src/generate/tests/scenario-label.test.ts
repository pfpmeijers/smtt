import { assertContains, assertMatchesReference, assertNotContains, createFeatures, test, } from "./utils"
import { type StateMachines, validateStateMachines } from "../../parse"

test("[TST-059] → [REQ-009/010/011/012/013/014/015/017/018/019/020/021]: Basic scenario label format", () => {
    const stateMachines: StateMachines = [{
        name: "m",
        states: [{name: "s1"}, {name: "s2"}],
        defaultPreconditions: [{state: "s3"}],
        transitions: [{
            id: "001",
            states: [{name: "s1"}],
            trigger: {type: "event", name: "e"},
            result: {name: "s2"},
        }],
    }, {
        name: "m0",
        states: [{name: "s3"}]
    }]
    validateStateMachines(stateMachines)
    const feature = createFeatures(stateMachines)["m"]
    assertContains(
        feature,
        "Scenario: [001] s1 → s2; when e; given s3"
    )
    assertMatchesReference(stateMachines, feature)
})

test("[TST-060] → [REQ-028/047/048/057/058/061/062]: Scenario label lower case", () => {
    const stateMachines: StateMachines = [{
        name: "m",
        states: [{name: "s1"}, {name: "s2"}],
        dataExampleValues: [{"a": "A"}],
        transitions: [{
            id: "001",
            states: [{name: "s1"}],
            trigger: {type: "event", name: "e",
                arguments: [{qualifier: "with", name: "a", condition: {operator: "=", value: "A"}}]},
            result: {name: "s2"},
        }],
    }]
    validateStateMachines(stateMachines)
    const feature = createFeatures(stateMachines)["m"]
    assertContains(
        feature,
        "Scenario Outline: [001] s1 → s2; when e with \"<a>\""
    )
    assertMatchesReference(stateMachines, feature)
})

test("[TST-061] → [REQ-024]: Scenario label omits given clause when no context states", () => {
    const stateMachines: StateMachines = [{
        name: "m",
        states: [{name: "s1"}, {name: "s2"}],
        transitions: [{
            states: [{name: "s1"}],
            trigger: {type: "event", name: "e"},
            result: {name: "s2"},
        }],
    }]
    validateStateMachines(stateMachines)
    const feature = createFeatures(stateMachines)["m"]
    assertNotContains(feature, "; given")
    assertMatchesReference(stateMachines, feature)
})

test("[TST-062] → [REQ-021/022/023/025]: Scenario label includes context states in effective order", () => {
    const stateMachines: StateMachines = [{
        name: "m",
        states: [{name: "s1"}],
        defaultPreconditions: [{state: "s2"}, {state: "s3"}],
        transitions: [{
            states: [{name: "s1"}],
            trigger: {type: "event", name: "e"},
            result: {name: "s1"},
        }],
    }, {
        name: "m0",
        states: [{name: "s2"}, {name: "s3"}]
    }]
    validateStateMachines(stateMachines)
    const feature = createFeatures(stateMachines)["m"]
    assertContains(feature, "; given s2, s3")
    assertMatchesReference(stateMachines, feature)
})
