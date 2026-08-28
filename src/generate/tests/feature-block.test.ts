import { assertContains, assertMatchesReference, createFeatures, test, } from "./utils"
import { type StateMachines, validateStateMachines } from "../../parse"

test("[TST-023] → [REQ-001/002/003/131]: Feature file per state machine", () => {
    const stateMachines: StateMachines = [{name: "m 1", states: [{name: "s"}]}]
    validateStateMachines(stateMachines)
    const features = createFeatures(stateMachines)
    const feature = features["m 1"]
    assertContains(feature, "Feature: m 1")
    assertMatchesReference(stateMachines, feature)
})

test("[TST-024] → [REQ-004/005/006]: Feature block includes overview when present", () => {
    const stateMachines: StateMachines = [{
        name: "m",
        states: [{name: "s"}],
        overview: "Manages shopping cart lifecycle"
    }]
    validateStateMachines(stateMachines)
    const feature = createFeatures(stateMachines)["m"]
    assertContains(feature, "Feature: m\n  Manages shopping cart lifecycle")
    assertMatchesReference(stateMachines, feature)
})

test("[TST-025] → [REQ-004/005/008]: Feature block omits description when overview is null", () => {
    const stateMachines: StateMachines = [{name: "m", overview: null, states: [{name: "s"}]}]
    validateStateMachines(stateMachines)
    const feature = createFeatures(stateMachines)["m"]
    assertContains(feature, "Feature: m\n")
    assertMatchesReference(stateMachines, feature)
})
