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
        dataValueCombinations: [{a: "0"}, {a: "1"}, {a: "2"}],
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
        dataValueCombinations: [{a: "0"}, {a: "1"}, {a: "2"}],
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
        dataValueCombinations: [{a: "1"}, {a: "2"}],
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
        dataValueCombinations: [{a: "1"}, {a: "2"}, {a: "3"}, {a: "4"}],
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
        dataValueCombinations: [{a: "1"}, {a: "2"}, {a: "3"}],
        transitions: [{
            states: [{name: "s", arguments: [{name: "a", condition: {operator: "not in", value: ["2"]}}]}],
            trigger: {type: "event", name: "e"},
            result: {name: "s"},
        }],
    }]
    validateStateMachines(stateMachines)
    const feature = createFeatures(stateMachines)["m"]
    assertContains(feature, "| 1 |")
    assertNotContains(feature, "| 2 |")
    // `3` survives the filter too, but renames `1` (REQ-440).
    assertNotContains(feature, "| 3 |")
    assertMatchesReference(stateMachines, feature)
})

test("[TST-007] → [REQ-086/087/092/093]: In-range inclusive both bounds", () => {
    const stateMachines: StateMachines = [{
        name: "m",
        states: [{name: "s"}],
        dataValueCombinations: [{a: "0"}, {a: "1"}, {a: "2"}, {a: "3"}, {a: "4"}, {a: "5"}],
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
        dataValueCombinations: [{a: "0"}, {a: "1"}, {a: "2"}, {a: "3"}, {a: "4"}, {a: "5"}],
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
        dataValueCombinations: [{a: "0"}, {a: "1"}, {a: "2"}, {a: "3"}, {a: "4"}, {a: "5"}],
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
        dataValueCombinations: [{a: "0"}, {a: "1"}, {a: "2"}, {a: "3"}],
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

test("[TST-011] → [REQ-086/087/432]: As binds the attribute to its literal value", () => {
    const stateMachines: StateMachines = [{
        name: "m",
        states: [{name: "s"}],
        dataValueCombinations: [{a: "a1"}, {a: "a2"}],
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

test("[TST-012] → [REQ-095]: Text inequality condition filters out the matching value", () => {
    const stateMachines: StateMachines = [{
        name: "m",
        states: [{name: "s"}],
        dataValueCombinations: [{a: "a1"}, {a: "a2"}],
        transitions: [{
            states: [{name: "s", arguments: [{name: "a", condition: {operator: "<>", value: "a1"}}]}],
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
        dataValueCombinations: [{a: "1"}, {a: ""}],
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
        dataValueCombinations: [{a: "0"}],
        transitions: [{
            states: [{name: "s", arguments: [{name: "a", condition: {operator: ">", value: "5"}}]}],
            trigger: {type: "event", name: "e"},
            result: {name: "s"},
        }],
    }]
    assertThrowMatchesReference(stateMachines, () => createFeatures(stateMachines),
        'State machine `m`: Empty examples table for anonymous transition.\n' +
        '1 candidate row(s) available:\n{ a=0 }.\n' +
        'No row satisfied every condition:\n' +
        '  - `a` > 5 (declared on `m`#?)')
})

test("[TST-015] → [REQ-075] Empty value on a non-undefined operator is rejected", () => {
    const stateMachines: StateMachines = [{
        name: "m",
        states: [{name: "s"}],
        dataValueCombinations: [{a: "1"}, {a: ""}],
        transitions: [{
            states: [{name: "s", arguments: [{name: "a", condition: {operator: "=", value: ""}}]}],
            trigger: {type: "event", name: "e"},
            result: {name: "s"},
        }],
    }]
    assertThrowMatchesReference(stateMachines, () => createFeatures(stateMachines),
        'State machine `m`: Invalid condition for attribute `a`: operator `=` cannot be used with an empty value. ' +
        'Use { operator: "undefined" } to match absent/empty values instead.')
})

test("[TST-175] → [REQ-427]: Reference condition compares two attributes of the same row", () => {
    const stateMachines: StateMachines = [{
        name: "m",
        states: [{name: "s"}],
        dataValueCombinations: [{a1: "1", a2: "1"}, {a1: "2", a2: "9"}],
        transitions: [{
            states: [{name: "s", arguments: [
                {name: "a1"},
                {name: "a2", condition: {operator: "=", value: "a1", valueIsReference: true}},
            ]}],
            trigger: {type: "event", name: "e"},
            result: {name: "s"},
        }],
    }]
    validateStateMachines(stateMachines)
    const feature = createFeatures(stateMachines)["m"]
    // Only the row whose `a2` equals its own `a1` survives; the reference resolves per row.
    assertContains(feature, "      | a1 | a2 |\n      | 1  | 1  |")
    assertNotContains(feature, "| 9  |")
    assertMatchesReference(stateMachines, feature)
})

test("[TST-176] → [REQ-427]: Reference condition on an attribute absent from the table filters out every row", () => {
    const stateMachines: StateMachines = [{
        name: "m",
        states: [{name: "s"}],
        dataValueCombinations: [{a1: "1"}],
        transitions: [{
            states: [{
                name: "s", arguments: [{name: "a1", condition: {operator: "as", value: "a9", valueIsReference: true}}],
            }],
            trigger: {type: "event", name: "e"},
            result: {name: "s"},
        }],
    }]
    assertThrowMatchesReference(stateMachines, () => createFeatures(stateMachines),
        'State machine `m`: Empty examples table for anonymous transition.\n' +
        '1 candidate row(s) available:\n{ a1=1 }.\n' +
        'No row satisfied every condition:\n' +
        '  - `a1` as `a9` (declared on `m`#?)')
})
