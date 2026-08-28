import { assertContains, assertMatchesReference, createFeatures, test, } from "./utils"
import { type StateMachines, validateStateMachines } from "../../parse"

test("[TST-001] → [REQ-026/027/049]: Arguments appear in scenario label state names", () => {
    const stateMachines: StateMachines = [{
        name: "m",
        states: [{name: "s1"}, {name: "s2"}],
        dataExampleValues: [{a1: "1", a2: "2", a3: "3"}],
        defaultPreconditions: [{
            state: "s3",
            arguments: [{qualifier: "on", name: "a3"}],
        }],
        transitions: [{
            states: [{name: "s1", arguments: [{qualifier: "as", name: "a1"}]}],
            trigger: {type: "event", name: "e", arguments: [{qualifier: "with", name: "ae"}]},
            result: {name: "s2", arguments: [{qualifier: "from", name: "a2"}]},
        }],
    }, {
        name: "m0",
        states: [{name: "s3"}],
    }]
    validateStateMachines(stateMachines)
    const feature = createFeatures(stateMachines)["m"]
    assertContains(feature, 's1 as "<a1>" → s2 from "<a2>"; when e with "<ae>"; given s3 on "<a3>"')
    assertMatchesReference(stateMachines, feature)
})
