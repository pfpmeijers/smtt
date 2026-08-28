import { strict as assert } from "node:assert"
import { assertMatchesReference, createFeatures, test, } from "./utils"
import { type StateMachines, validateStateMachines } from "../../parse"

test("[TST-031] → [REQ-159]: Scenario label truncated to 200 chars with an ellipsis", () => {
    const stateMachines: StateMachines = [{
        name: "m",
        states: [{name: "s"}],
        transitions: [{
            id: "001",
            states: [{name: "s"}],
            // A very long trigger name forces the label past 200 chars.
            trigger: {type: "event", name: "e" + "-".repeat(300)},
            result: {name: "s"},
            notes: "",
        }],
    }]
    validateStateMachines(stateMachines)
    const feature = createFeatures(stateMachines)["m"]
    const scenarioLine = feature.split("\n").find((line) => line.trimStart().startsWith("Scenario"))!
    assert.ok(scenarioLine.length <= 200, `Scenario label exceeds 200 chars: ${scenarioLine.length}`)
    assert.ok(scenarioLine.trimEnd().endsWith("..."), `Scenario label not truncated with ellipsis: ${scenarioLine}`)
    assertMatchesReference(stateMachines, feature)
})

