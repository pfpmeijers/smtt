import { assertThrowMatchesReference, createFeatures, test, } from "./utils"
import { StateMachines } from "../../parse"

test("[TST-043] → [REQ-080]: incremented modifier on a non-numeric value raises an error", () => {
    const stateMachines: StateMachines = [{
        name: "m",
        states: [{name: "s"}],
        dataExampleValues: [{a: "foo"}],
        transitions: [{
            states: [{name: "s", arguments: [{name: "a"}]}],
            trigger: {type: "event", name: "e"},
            result: {name: "s", arguments: [{modifier: "incremented", name: "a"}]},
            notes: "",
        }],
    }]
    assertThrowMatchesReference(stateMachines, () => createFeatures(stateMachines),
        'State machine `m`: Anonymous transition: Invalid modifier `incremented` for attribute `a` on result `s`: expected a numeric value but got "foo"')
})

test("[TST-044] → [REQ-136]: Modifier without a prior base reference raises an error", () => {
    const stateMachines: StateMachines = [{
        name: "m",
        states: [{name: "s"}],
        dataExampleValues: [{count: "1"}],
        transitions: [{
            states: [{name: "s"}],
            trigger: {type: "event", name: "e"},
            result: {name: "s", arguments: [{modifier: "incremented", name: "count"}]},
            notes: "",
        }],
    }]
    assertThrowMatchesReference(stateMachines, () => createFeatures(stateMachines),
        `State machine \`m\`: Anonymous transition: Invalid modifier \`incremented\` for attribute \`count\` on result \`s\`: no base reference found in the transition`)
})

test("[TST-045] → [REQ-141]: 'different' modifier with fewer than two distinct values raises an error", () => {
    const stateMachines: StateMachines = [{
        name: "m",
        states: [{name: "s"}],
        dataExampleValues: [{a: "only"}],
        transitions: [{
            states: [{name: "s", arguments: [{name: "a"}]}],
            trigger: {type: "event", name: "e"},
            result: {name: "s", arguments: [{modifier: "different", name: "a"}]},
            notes: "",
        }],
    }]
    assertThrowMatchesReference(stateMachines, () => createFeatures(stateMachines),
        `State machine \`m\`: Anonymous transition: Invalid modifier \`different\` for attribute \`a\` on result \`s\`: expected at least two distinct values but found 1 (\`only\`)`)
})

test("[TST-107] → [REQ-141]: 'different' modifier with only an undefined value found reports it as `<undefined>`", () => {
    const stateMachines: StateMachines = [{
        name: "m",
        states: [{name: "s"}],
        dataExampleValues: [{a: ""}],
        transitions: [{
            states: [{name: "s", arguments: [{name: "a"}]}],
            trigger: {type: "event", name: "e"},
            result: {name: "s", arguments: [{modifier: "different", name: "a"}]},
            notes: "",
        }],
    }]
    assertThrowMatchesReference(stateMachines, () => createFeatures(stateMachines),
        `State machine \`m\`: Anonymous transition: Invalid modifier \`different\` for attribute \`a\` on result \`s\`: expected at least two distinct values but found 1 (<undefined>)`)
})


