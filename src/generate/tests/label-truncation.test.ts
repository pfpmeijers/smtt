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
            trigger: {type: "event", name: "e"},
            result: {name: "s"},
            // A very long description forces the label past 200 chars.
            notes: "d".repeat(300),
        }],
    }]
    validateStateMachines(stateMachines)
    const feature = createFeatures(stateMachines)["m"]
    const scenarioLine = feature.split("\n").find((line) => line.trimStart().startsWith("Scenario"))!
    assert.ok(scenarioLine.length <= 200, `Scenario label exceeds 200 chars: ${scenarioLine.length}`)
    assert.ok(scenarioLine.trimEnd().endsWith("..."), `Scenario label not truncated with ellipsis: ${scenarioLine}`)
    assertMatchesReference(stateMachines, feature)
})

