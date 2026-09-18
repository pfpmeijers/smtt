import { assertThrowMatchesReference, createFeatures, test, } from "./utils"
import { StateMachines } from "../../parse"

test("[TST-043] → [REQ-080]: incremented modifier on a non-numeric value raises an error", () => {
    const stateMachines: StateMachines = [{
        name: "m",
        states: [{name: "s"}],
        dataValueCombinations: [{a: "foo"}],
        transitions: [{
            states: [{name: "s", arguments: [{name: "a"}]}],
            trigger: {type: "event", name: "e"},
            result: {name: "s", arguments: [{modifier: "incremented", name: "a"}]},
            notes: "",
        }],
    }]
    assertThrowMatchesReference(stateMachines, () => createFeatures(stateMachines),
        'State machine `m`: transition \`000\`: Invalid modifier `incremented` for attribute `a` on result `s`: expected a numeric value but got "foo"')
})

test("[TST-044] → [REQ-136]: Modifier without a prior base reference raises an error", () => {
    const stateMachines: StateMachines = [{
        name: "m",
        states: [{name: "s"}],
        dataValueCombinations: [{count: "1"}],
        transitions: [{
            states: [{name: "s"}],
            trigger: {type: "event", name: "e"},
            result: {name: "s", arguments: [{modifier: "incremented", name: "count"}]},
            notes: "",
        }],
    }]
    assertThrowMatchesReference(stateMachines, () => createFeatures(stateMachines),
        `State machine \`m\`: transition \`000\`: Invalid modifier \`incremented\` for attribute \`count\` on result \`s\`: no base reference found in the transition`)
})
