import {
    assertBlankLinesBetween,
    assertIndented,
    assertMatchesReference,
    assertNoBlankLineBetween,
    createFeatures,
    test,
} from "./utils"
import { type StateMachines, validateStateMachines } from "../../parse"

test("[TST-032] → [REQ-119/120]: Feature header at 0 indent", () => {
    const stateMachines: StateMachines = [{name: "m", states: [{name: "s"}]}]
    validateStateMachines(stateMachines)
    const feature = createFeatures(stateMachines)["m"]
    assertIndented(feature, "Feature:", 0)
    assertMatchesReference(stateMachines, feature)
})

test("[TST-033] → [REQ-119/121]: Overview indented 2 spaces", () => {
    const stateMachines: StateMachines = [{name: "m", overview: "Some description", states: [{name: "s"}]}]
    validateStateMachines(stateMachines)
    const feature = createFeatures(stateMachines)["m"]
    assertIndented(feature, "Some description", 2)
    assertMatchesReference(stateMachines, feature)
})

test("[TST-034] → [REQ-119/122]: Scenario keyword at 2 indent", () => {
    const stateMachines: StateMachines = [{
        name: "m",
        states: [{name: "s"}],
        transitions: [{
            states: [{name: "s"}],
            trigger: {type: "event", name: "e"},
            result: {name: "s"},
        }],
    }]
    validateStateMachines(stateMachines)
    const feature = createFeatures(stateMachines)["m"]
    assertIndented(feature, "Scenario", 2)
    assertMatchesReference(stateMachines, feature)
})

test("[TST-035] → [REQ-119/123]: Step keywords indented 4 spaces", () => {
    const stateMachines: StateMachines = [{
        name: "m",
        states: [{name: "s1"}],
        defaultPreconditions: [{state: "s2"}],
        transitions: [{
            states: [{name: "s1"}],
            trigger: {type: "event", name: "e"},
            result: {name: "s1"},
        }],
    }, {
        name: "m0",
        states: [{name: "s2"}]
    }]
    validateStateMachines(stateMachines)
    const feature = createFeatures(stateMachines)["m"]
    for (const keyword of ["Given", "And", "When", "Then"]) {
        assertIndented(feature, keyword, 4)
    }
    assertMatchesReference(stateMachines, feature)
})

test("[TST-036] → [REQ-119/124]: Notes comment indented 4 spaces", () => {
    const stateMachines: StateMachines = [{
        name: "m",
        states: [{name: "s"}],
        transitions: [{
            states: [{name: "s"}],
            trigger: {type: "event", name: "e"},
            result: {name: "s"},
            notes: "...",
        }],
    }]
    validateStateMachines(stateMachines)
    const feature = createFeatures(stateMachines)["m"]
    assertIndented(feature, "# Notes:", 4)
    assertMatchesReference(stateMachines, feature)
})

test("[TST-037] → [REQ-119/125]: Examples keyword indented 4 spaces", () => {
    const stateMachines: StateMachines = [{
        name: "m",
        states: [{name: "s"}],
        dataExampleValues: [{a: "1"}],
        transitions: [{
            states: [{name: "s", arguments: [{name: "a"}]}],
            trigger: {type: "event", name: "e"},
            result: {name: "s"},
        }],
    }]
    validateStateMachines(stateMachines)
    const feature = createFeatures(stateMachines)["m"]
    assertIndented(feature, "Examples:", 4)
    assertMatchesReference(stateMachines, feature)
})

test("[TST-038] → [REQ-119/126]: Examples table rows indented 6 spaces", () => {
    const stateMachines: StateMachines = [{
        name: "m",
        states: [{name: "s"}],
        dataExampleValues: [{a: "1"}],
        transitions: [{
            states: [{name: "s", arguments: [{name: "a"}]}],
            trigger: {type: "event", name: "e"},
            result: {name: "s"},
        }],
    }]
    validateStateMachines(stateMachines)
    const feature = createFeatures(stateMachines)["m"]
    assertIndented(feature, "| a |", 6)
    assertMatchesReference(stateMachines, feature)
})

test("[TST-039] → [REQ-127]: Blank line after Feature block before first Scenario", () => {
    const stateMachines: StateMachines = [{
        name: "m",
        states: [{name: "s"}],
        transitions: [{
            states: [{name: "s"}],
            trigger: {type: "event", name: "e"},
            result: {name: "s"},
        }],
    }]
    validateStateMachines(stateMachines)
    const feature = createFeatures(stateMachines)["m"]
    assertBlankLinesBetween(feature, "Feature: m", "Scenario", 1)
    assertMatchesReference(stateMachines, feature)
})

test("[TST-040] → [REQ-128]: Blank line between consecutive Scenarios", () => {
    const stateMachines: StateMachines = [{
        name: "m",
        states: [{name: "s1"}, {name: "s2"}],
        transitions: [{
            states: [{name: "s1"}],
            trigger: {type: "event", name: "e1"},
            result: {name: "s2"},
        }, {
            states: [{name: "s2"}],
            trigger: {type: "event", name: "e2"},
            result: {name: "s1"},
        },
        ],
    }]
    validateStateMachines(stateMachines)
    const feature = createFeatures(stateMachines)["m"]
    // Two `Scenario:` blocks must be separated by exactly one blank line.
    assertBlankLinesBetween(feature, "Scenario:", "Scenario:", 1)
    assertMatchesReference(stateMachines, feature)
})

test("[TST-041] → [REQ-129]: No blank line between last Then and Notes", () => {
    const stateMachines: StateMachines = [{
        name: "m",
        states: [{name: "s"}],
        transitions: [{
            states: [{name: "s"}],
            trigger: {type: "event", name: "e"},
            result: {name: "s"},
            notes: "...",
        }],
    }]
    validateStateMachines(stateMachines)
    const feature = createFeatures(stateMachines)["m"]
    assertNoBlankLineBetween(feature, "Then expect", "# Notes:")
    assertMatchesReference(stateMachines, feature)
})

test("[TST-042] → [REQ-130]: No blank line between Examples keyword and table", () => {
    const stateMachines: StateMachines = [{
        name: "m",
        states: [{name: "s"}],
        dataExampleValues: [{a: "1"}],
        transitions: [{
            states: [{name: "s", arguments: [{name: "a"}]}],
            trigger: {type: "event", name: "e"},
            result: {name: "s"},
        }],
    }]
    validateStateMachines(stateMachines)
    const feature = createFeatures(stateMachines)["m"]
    assertNoBlankLineBetween(feature, "Examples:", "| a |")
    assertMatchesReference(stateMachines, feature)
})
