import { assertThrowMatchesReference, createFeatures, test, } from "./utils"
import { StateMachines } from "../../parse"

test("[TST-067] → [REQ-154]: Ambiguous state name across machines raises an error", () => {
    const stateMachines: StateMachines = [
        {
            name: "m1",
            states: [{name: "s"}]
        },
        {
            name: "m2",
            states: [{name: "s"}]
        },
    ]
    assertThrowMatchesReference(stateMachines,
        () => createFeatures(stateMachines),
        `Ambiguous state name lookup: duplicate state names across machines: s (REQ-154).`)
})

test("[TST-068] → [REQ-155]: Circular state-trigger expansion chain raises an error", () => {
    const stateMachines: StateMachines = [
        {
            name: "m1",
            states: [{name: "s1"}],
            transitions: [{
                trigger: {type: "state", name: "s2"},
                result: {name: "s1"}
            }],
        },
        {
            name: "m2",
            states: [{name: "s2"}],
            transitions: [{
                trigger: {type: "state", name: "s1"},
                result: {name: "s2"}
            }],
        },
    ]
    assertThrowMatchesReference(stateMachines, () => createFeatures(stateMachines),
        'Invalid state machine "m1": ' +
        'anonymous transition participates in a circular state-trigger expansion chain at trigger "s2" (REQ-155).')
})

