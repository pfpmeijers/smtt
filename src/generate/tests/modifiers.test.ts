import { assertContains, assertMatchesReference, createFeatures, test, } from "./utils"
import { type StateMachines, validateStateMachines } from "../../parse"

test("[TST-050] → [REQ-053/065/070/076/077/078/079/137/152]: Incremented modifier adds derived column", () => {
    const stateMachines: StateMachines = [{
        name: "m",
        states: [{name: "s"}],
        dataExampleValues: [{a: "1"}, {a: "3"}, {a: "2"}],
        transitions: [{
            states: [{name: "s", arguments: [{name: "a"}]}],
            trigger: {type: "event", name: "e"},
            result: {name: "s", arguments: [{modifier: "incremented", name: "a"}]},
            notes: "",
        }],
    }]
    validateStateMachines(stateMachines)
    const feature = createFeatures(stateMachines)["m"]
    assertContains(
        feature,
        "      | a | incremented a |\n" +
        "      | 1 | 2             |\n" +
        "      | 3 | 4             |\n" +
        "      | 2 | 3             |"
    )
    assertMatchesReference(stateMachines, feature)
})

test("[TST-051] → [REQ-065/077/078]: Decremented modifier adds derived column", () => {
    const stateMachines: StateMachines = [{
        name: "m",
        states: [{name: "s"}],
        dataExampleValues: [{a: "0"}, {a: "2"}, {a: "1"}],
        transitions: [{
            states: [{name: "s", arguments: [{name: "a"}]}],
            trigger: {type: "event", name: "e"},
            result: {name: "s", arguments: [{modifier: "decremented", name: "a"}]},
            notes: "",
        }],
    }]
    validateStateMachines(stateMachines)
    const feature = createFeatures(stateMachines)["m"]
    assertContains(
        feature,
        "      | a | decremented a |\n" +
        "      | 0 | -1            |\n" +
        "      | 2 | 1             |\n" +
        "      | 1 | 0             |"
    )
    assertMatchesReference(stateMachines, feature)
})

test("[TST-052] → [REQ-054/065/081/082]: Next modifier uses circular next value", () => {
    const stateMachines: StateMachines = [{
        name: "m",
        states: [{name: "s"}],
        dataExampleValues: [{a: "a0"}, {a: "a1"}, {a: "a2"}],
        transitions: [{
            states: [{name: "s", arguments: [{name: "a"}]}],
            trigger: {type: "event", name: "e", arguments: [{modifier: "next", name: "a"}]},
            result: {name: "s"},
            notes: "",
        }],
    }]
    validateStateMachines(stateMachines)
    const feature = createFeatures(stateMachines)["m"]
    assertContains(
        feature,
        "      | a  | next a |\n" +
        "      | a0 | a1     |\n" +
        "      | a1 | a2     |\n" +
        "      | a2 | a0     |"
    )
    assertMatchesReference(stateMachines, feature)
})

test("[TST-053] → [REQ-065/081/082]: Previous modifier uses circular previous value", () => {
    const stateMachines: StateMachines = [{
        name: "m",
        states: [{name: "s"}],
        dataExampleValues: [{a: "a0"}, {a: "a1"}, {a: "a2"}],
        transitions: [{
            states: [{name: "s", arguments: [{name: "a"}]}],
            trigger: {type: "event", name: "e", arguments: [{modifier: "previous", name: "a"}]},
            result: {name: "s"},
            notes: "",
        }],
    }]
    validateStateMachines(stateMachines)
    const feature = createFeatures(stateMachines)["m"]
    assertContains(
        feature,
        "      | a  | previous a |\n" +
        "      | a0 | a2         |\n" +
        "      | a1 | a0         |\n" +
        "      | a2 | a1         |"
    )
    assertMatchesReference(stateMachines, feature)
})

test("[TST-054] → [REQ-065/070/071/072/083/084/085]: Different modifier uses concatenated tables with circular next", () => {
    const stateMachines: StateMachines = [{
        name: "m",
        states: [{name: "s"}],
        dataExampleValues: [{a: "a1"}, {a: "a2"}],
        dataOtherValues: [{a: "a3"}],
        transitions: [{
            states: [{name: "s", arguments: [{name: "a"}]}],
            trigger: {type: "event", name: "e", arguments: [{modifier: "different", name: "a"}]},
            result: {name: "s"},
            notes: "",
        }],
    }]
    validateStateMachines(stateMachines)
    const feature = createFeatures(stateMachines)["m"]
    assertContains(
        feature,
        "      | a  | different a |\n" +
        "      | a1 | a2          |\n" +
        "      | a2 | a3          |"
    )
    assertMatchesReference(stateMachines, feature)
})

test("[TST-055] → [REQ-083/085]: Other modifier is synonym for different", () => {
    const stateMachines: StateMachines = [{
        name: "m",
        states: [{name: "s"}],
        dataExampleValues: [{a: "1"}, {a: "2"}],
        dataOtherValues: [{a: "3"}],
        transitions: [{
            states: [{name: "s", arguments: [{name: "a"}]}],
            trigger: {type: "event", name: "e", arguments: [{modifier: "other", name: "a"}]},
            result: {name: "s"},
            notes: "",
        }],
    }]
    validateStateMachines(stateMachines)
    const feature = createFeatures(stateMachines)["m"]
    assertContains(feature, "e \"<different a>\"")
    assertMatchesReference(stateMachines, feature)
})

test("[TST-056] → [REQ-083/085]: Not modifier is synonym for different", () => {
    const stateMachines: StateMachines = [{
        name: "m",
        states: [{name: "s"}],
        dataExampleValues: [{a: "1"}, {a: "2"}],
        dataOtherValues: [{a: "3"}],
        transitions: [{
            states: [{name: "s", arguments: [{name: "a"}]}],
            trigger: {type: "event", name: "e", arguments: [{modifier: "not", name: "a"}]},
            result: {name: "s"},
            notes: "",
        }],
    }]
    validateStateMachines(stateMachines)
    const feature = createFeatures(stateMachines)["m"]
    assertContains(feature, "e \"<different a>\"")
    assertMatchesReference(stateMachines, feature)
})

