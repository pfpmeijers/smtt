import {
    assertContains,
    assertMatchesReference,
    assertNotContains,
    assertThrowMatchesReference,
    createFeatures,
    test,
} from "./utils"
import { type StateMachines, validateStateMachines } from "../../parse"

test("[TST-002] → [REQ-069/086/087/090/097/098]: Equality condition filters rows", () => {
    const stateMachines: StateMachines = [{
        name: "m",
        states: [{name: "s"}],
        dataExampleValues: [{a: "0"}, {a: "1"}, {a: "2"}],
        transitions: [{
            states: [{name: "s", arguments: [{name: "a", condition: {operator: "=", value: "1"}}]}],
            trigger: {type: "event", name: "e"},
            result: {name: "s"},
        }],
    }]
    validateStateMachines(stateMachines)
    const feature = createFeatures(stateMachines)["m"]
    assertContains(feature, "      | a |\n      | 1 |")
    assertMatchesReference(stateMachines, feature)
})

test("[TST-003] → [REQ-086/087/090]: Greater-than-or-equal condition filters rows", () => {
    const stateMachines: StateMachines = [{
        name: "m",
        states: [{name: "s"}],
        dataExampleValues: [{a: "0"}, {a: "1"}, {a: "2"}],
        transitions: [{
            states: [{name: "s", arguments: [{name: "a", condition: {operator: ">=", value: "1"}}]}],
            trigger: {type: "event", name: "e"},
            result: {name: "s"},
        }],
    }]
    validateStateMachines(stateMachines)
    const feature = createFeatures(stateMachines)["m"]
    assertContains(feature, "| 1 |")
    assertContains(feature, "| 2 |")
    assertNotContains(feature, "| 0 |")
    assertMatchesReference(stateMachines, feature)
})

test("[TST-004] → [REQ-086/087/090]: Not-equal condition filters rows", () => {
    const stateMachines: StateMachines = [{
        name: "m",
        states: [{name: "s"}],
        dataExampleValues: [{a: "1"}, {a: "2"}],
        transitions: [{
            states: [{name: "s", arguments: [{name: "a", condition: {operator: "<>", value: "1"}}]}],
            trigger: {type: "event", name: "e"},
            result: {name: "s"},
        }],
    }]
    validateStateMachines(stateMachines)
    const feature = createFeatures(stateMachines)["m"]
    assertContains(feature, "| 2 |")
    assertNotContains(feature, "| 1 |")
    assertMatchesReference(stateMachines, feature)
})

test("[TST-005] → [REQ-086/087/091]: In-set condition filters rows", () => {
    const stateMachines: StateMachines = [{
        name: "m",
        states: [{name: "s"}],
        dataExampleValues: [{a: "1"}, {a: "2"}, {a: "3"}, {a: "4"}],
        transitions: [{
            states: [{name: "s", arguments: [{name: "a", condition: {operator: "in", value: ["1", "4"]}}]}],
            trigger: {type: "event", name: "e"},
            result: {name: "s"},
        }],
    }]
    validateStateMachines(stateMachines)
    const feature = createFeatures(stateMachines)["m"]
    assertContains(feature, "| 1 |")
    assertContains(feature, "| 4 |")
    assertNotContains(feature, "| 2 |")
    assertNotContains(feature, "| 3 |")
    assertMatchesReference(stateMachines, feature)
})

test("[TST-006] → [REQ-086/087/091]: Not-in-set condition filters rows", () => {
    const stateMachines: StateMachines = [{
        name: "m",
        states: [{name: "s"}],
        dataExampleValues: [{a: "1"}, {a: "2"}, {a: "3"}],
        transitions: [{
            states: [{name: "s", arguments: [{name: "a", condition: {operator: "not in", value: ["2"]}}]}],
            trigger: {type: "event", name: "e"},
            result: {name: "s"},
        }],
    }]
    validateStateMachines(stateMachines)
    const feature = createFeatures(stateMachines)["m"]
    assertContains(feature, "| 1 |")
    assertContains(feature, "| 3 |")
    assertNotContains(feature, "| 2 |")
    assertMatchesReference(stateMachines, feature)
})

test("[TST-007] → [REQ-086/087/092/093/145]: In-range inclusive both bounds", () => {
    const stateMachines: StateMachines = [{
        name: "m",
        states: [{name: "s"}],
        dataExampleValues: [{a: "0"}, {a: "1"}, {a: "2"}, {a: "3"}, {a: "4"}, {a: "5"}],
        transitions: [{
            states: [{name: "s", arguments: [{name: "a", condition: {operator: "in range", value: "[1, 4]"}}]}],
            trigger: {type: "event", name: "e"},
            result: {name: "s"},
        }],
    }]
    validateStateMachines(stateMachines)
    const feature = createFeatures(stateMachines)["m"]
    assertContains(feature, "| 1 |")
    assertContains(feature, "| 4 |")
    assertNotContains(feature, "| 0 |")
    assertNotContains(feature, "| 5 |")
    assertMatchesReference(stateMachines, feature)
})

test("[TST-008] → [REQ-086/087/093/094]: In-range exclusive upper bound", () => {
    const stateMachines: StateMachines = [{
        name: "m",
        states: [{name: "s"}],
        dataExampleValues: [{a: "0"}, {a: "1"}, {a: "2"}, {a: "3"}, {a: "4"}, {a: "5"}],
        transitions: [{
            states: [{name: "s", arguments: [{name: "a", condition: {operator: "in range", value: "[1, 4)"}}]}],
            trigger: {type: "event", name: "e"},
            result: {name: "s"},
        }],
    }]
    validateStateMachines(stateMachines)
    const feature = createFeatures(stateMachines)["m"]
    assertContains(feature, "| 1 |")
    assertNotContains(feature, "| 4 |")
    assertMatchesReference(stateMachines, feature)
})

test("[TST-009] → [REQ-086/087/093/094]: In-range exclusive lower bound", () => {
    const stateMachines: StateMachines = [{
        name: "m",
        states: [{name: "s"}],
        dataExampleValues: [{a: "0"}, {a: "1"}, {a: "2"}, {a: "3"}, {a: "4"}, {a: "5"}],
        transitions: [{
            states: [{name: "s", arguments: [{name: "a", condition: {operator: "in range", value: "(0, 4]"}}]}],
            trigger: {type: "event", name: "e"},
            result: {name: "s"},
        }],
    }]
    validateStateMachines(stateMachines)
    const feature = createFeatures(stateMachines)["m"]
    assertContains(feature, "| 1 |")
    assertContains(feature, "| 4 |")
    assertNotContains(feature, "| 0 |")
    assertMatchesReference(stateMachines, feature)
})

test("[TST-010] → [REQ-086/087/092]: Not-in-range condition excludes matching rows", () => {
    const stateMachines: StateMachines = [{
        name: "m",
        states: [{name: "s"}],
        dataExampleValues: [{a: "0"}, {a: "1"}, {a: "2"}, {a: "3"}],
        transitions: [{
            states: [{name: "s", arguments: [{name: "a", condition: {operator: "not in range", value: "[1, 2]"}}]}],
            trigger: {type: "event", name: "e"},
            result: {name: "s"},
        }],
    }]
    validateStateMachines(stateMachines)
    const feature = createFeatures(stateMachines)["m"]
    assertContains(feature, "| 0 |")
    assertContains(feature, "| 3 |")
    assertNotContains(feature, "| 1 |")
    assertNotContains(feature, "| 2 |")
    assertMatchesReference(stateMachines, feature)
})

test("[TST-011] → [REQ-086/087/095]: As condition filters to text match", () => {
    const stateMachines: StateMachines = [{
        name: "m",
        states: [{name: "s"}],
        dataExampleValues: [{a: "a1"}, {a: "a2"}],
        transitions: [{
            states: [{name: "s", arguments: [{name: "a", condition: {operator: "as", value: "a1"}}]}],
            trigger: {type: "event", name: "e"},
            result: {name: "s"},
        }],
    }]
    validateStateMachines(stateMachines)
    const feature = createFeatures(stateMachines)["m"]
    assertContains(feature, "| a1 |")
    assertNotContains(feature, "| a2 |")
    assertMatchesReference(stateMachines, feature)
})

test("[TST-012] → [REQ-095]: Not-as condition filters out text match", () => {
    const stateMachines: StateMachines = [{
        name: "m",
        states: [{name: "s"}],
        dataExampleValues: [{a: "a1"}, {a: "a2"}],
        transitions: [{
            states: [{name: "s", arguments: [{name: "a", condition: {operator: "not as", value: "a1"}}]}],
            trigger: {type: "event", name: "e"},
            result: {name: "s"},
        }],
    }]
    validateStateMachines(stateMachines)
    const feature = createFeatures(stateMachines)["m"]
    assertContains(feature, "| a2 |")
    assertNotContains(feature, "| a1 |")
    assertMatchesReference(stateMachines, feature)
})

test("[TST-013] → [REQ-086/087/096]: Undefined condition filters to empty/absent values", () => {
    const stateMachines: StateMachines = [{
        name: "m",
        states: [{name: "s"}],
        dataExampleValues: [{a: "1"}, {a: ""}],
        transitions: [{
            states: [{name: "s", arguments: [{name: "a", condition: {operator: "undefined"}}]}],
            trigger: {type: "event", name: "e"},
            result: {name: "s"},
        }],
    }]
    validateStateMachines(stateMachines)
    const feature = createFeatures(stateMachines)["m"]
    assertContains(feature, "|   |")
    assertNotContains(feature, "| 1 |")
    assertMatchesReference(stateMachines, feature)
})

test("[TST-014] → [REQ-099/100]: All rows filtered out raises error", () => {
    const stateMachines: StateMachines = [{
        name: "m",
        states: [{name: "s"}],
        dataExampleValues: [{a: "0"}],
        transitions: [{
            states: [{name: "s", arguments: [{name: "a", condition: {operator: ">", value: "5"}}]}],
            trigger: {type: "event", name: "e"},
            result: {name: "s"},
        }],
    }]
    assertThrowMatchesReference(stateMachines, () => createFeatures(stateMachines),
        'Empty examples table for transition undefined in state machine m')
})

test("[TST-015] → [REQ-075] Empty value on a non-undefined operator is rejected", () => {
    const stateMachines: StateMachines = [{
        name: "m",
        states: [{name: "s"}],
        dataExampleValues: [{a: "1"}, {a: ""}],
        transitions: [{
            states: [{name: "s", arguments: [{name: "a", condition: {operator: "=", value: ""}}]}],
            trigger: {type: "event", name: "e"},
            result: {name: "s"},
        }],
    }]
    assertThrowMatchesReference(stateMachines, () => createFeatures(stateMachines),
        'Invalid condition for attribute "a": operator "=" cannot be used with an empty value. ' + 
        'Use { operator: "undefined" } to match absent/empty values instead.')
})

