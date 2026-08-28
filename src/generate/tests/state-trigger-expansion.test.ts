import { strict as assert } from "node:assert"

import {
    assertContains,
    assertMatchesReference,
    assertNotContains,
    assertThrowMatchesReference,
    createFeatures,
    test,
} from "./utils"
import { type StateMachines, validateStateMachines } from "../../parse"

test("[TST-071] → [REQ-102/103/111]: Event trigger maps directly to When step", () => {
    const stateMachines: StateMachines = [{
        name: "m",
        states: [{name: "s"}],
        transitions: [{
            states: [{name: "s"}],
            trigger: {type: "event", name: "e"},
            result: {name: "s"},
        }],
    }]
    validateStateMachines(stateMachines)
    const feature = createFeatures(stateMachines)["m"]
    assertContains(feature, "When e")
    assertMatchesReference(stateMachines, feature)
})

test("[TST-072] → [REQ-102/104/106/107/109/112/132/134/135/150]: State trigger expands to source event", () => {
    const stateMachines: StateMachines = [{
        name: "m1",
        states: [{name: "s1"}],
        transitions: [{
                        trigger: {type: "event", name: "e"},
            result: {name: "s1"},
        }],
    }, {
        name: "m2",
        states: [{name: "s2"}],
        transitions: [{
                        trigger: {type: "state", name: "s1"},
            result: {name: "s2"},
        }],
    }
    ]
    validateStateMachines(stateMachines)
    const features = createFeatures(stateMachines)
    const feature = features["m2"]
    assertContains(feature,
        "    When e\n" +
        "    Then expect s1"
    )
    assertMatchesReference(stateMachines, feature)
})

test("[TST-073] → [REQ-109/110]: State trigger expansion adds intermediate Then", () => {
    const stateMachines: StateMachines = [{
        name: "m1",
        states: [{name: "s1"}],
        transitions: [{
                        trigger: {type: "event", name: "e"},
            result: {name: "s1"},
        }],
    }, {
        name: "m2",
        states: [{name: "s2"}],
        transitions: [{
                        trigger: {type: "state", name: "s1"},
            result: {name: "s2"},
        }],
    }
    ]
    validateStateMachines(stateMachines)
    const features = createFeatures(stateMachines)
    const feature = features["m2"]
    assertContains(feature,
        "    When e\n" +
        "    Then expect s1\n" +
        "    And expect s2"
    )
    assertMatchesReference(stateMachines, feature)
})

test("[TST-074] → [REQ-029/030/031/113]: State trigger with multiple expansion paths", () => {
    const stateMachines: StateMachines = [{
        name: "m1",
        states: [{name: "s0"}, {name: "s1"}],
        transitions: [{
                        trigger: {type: "event", name: "e1"},
            result: {name: "s1"},
        }, {
                        trigger: {type: "event", name: "e2"},
            result: {name: "s1"},
        },
        ],
    }, {
        name: "m2",
        states: [{name: "s2"}],
        transitions: [{
            id: "001",
                        trigger: {type: "state", name: "s1"},
            result: {name: "s2"},
        }],
    }
    ]
    validateStateMachines(stateMachines)
    const features = createFeatures(stateMachines)
    const feature = features["m2"]
    assertContains(feature, "When e1")
    assertContains(feature, "When e2")
    assertContains(feature, "[001.1]")
    assertContains(feature, "[001.2]")
    assertMatchesReference(stateMachines, feature)
})

test("[TST-075] → [REQ-108/146]: Recursive state trigger expansion", () => {
    const stateMachines: StateMachines = [{
        name: "m1",
        states: [{name: "s1"}],
        transitions: [{
                        trigger: {type: "event", name: "e"},
            result: {name: "s1"},
        }],
    }, {
        name: "m2",
        states: [{name: "s2"}],
        transitions: [{
                        trigger: {type: "state", name: "s1"},
            result: {name: "s2"},
        }],
    }, {
        name: "m3",
        states: [{name: "s3"}],
        transitions: [{
                        trigger: {type: "state", name: "s2"},
            result: {name: "s3"},
        }],
    }
    ]
    validateStateMachines(stateMachines)
    const features = createFeatures(stateMachines)
    const feature = features["m3"]
    assertContains(feature, "When e")
    assertContains(feature, "Then expect s1")
    assertContains(feature, "And expect s2")
    assertMatchesReference(stateMachines, feature)
})

test("[TST-076] → [REQ-114/115]: Expanded scenario merges Given steps from both transitions", () => {
    const stateMachines: StateMachines = [{
        name: "m1",
        states: [{name: "s1"}],
        defaultPreconditions: [{state: "s3"}],
        transitions: [{
            states: [{name: "s1"}],
            trigger: {type: "event", name: "e"},
            result: {name: "s1"},
        }],
    }, {
        name: "m2",
        states: [{name: "s2"}],
        transitions: [{
            states: [{name: "s2"}],
            trigger: {type: "state", name: "s1"},
            result: {name: "s2"},
        }],
    }, {
        name: "m3",
        states: [{name: "s3"}]
    }]

    validateStateMachines(stateMachines)
    const features = createFeatures(stateMachines)
    const feature = features["m2"]
    const stepsStart = feature.indexOf("Given ")
    const stepsRegion = feature.slice(stepsStart)
    const preconditions = ["s3", "s1", "s2"]
    const positions = preconditions.map((precondition) => stepsRegion.indexOf("initially " + precondition))
    positions.forEach((position, index) => {
        assert.notEqual(position, -1, `Expected to find "initially ${preconditions[index]}" in the Given steps`)
    })
    const sorted = [...positions].sort((left, right) => left - right)
    assert.deepEqual(positions, sorted, "Given steps out of expected order")
    assertMatchesReference(stateMachines, feature)
})

test("[TST-077] → [REQ-116]: Expanded scenario deduplicates same state with same arguments", () => {
    const stateMachines: StateMachines = [{
        name: "m1",
        states: [{name: "s1"}],
        dataExampleValues: [{a: "1"}],
        transitions: [{
            states: [{name: "s1", arguments: [{name: "a"}]}],
            trigger: {type: "event", name: "e"},
            result: {name: "s1"},
        }],
    }, {
        name: "m2",
        states: [{name: "s2"}],
        defaultPreconditions: [{state: "s1", arguments: [{name: "a"}]}],
        transitions: [{
                        trigger: {type: "state", name: "s1"},
            result: {name: "s2"},
        }]
    }]
    validateStateMachines(stateMachines)
    const features = createFeatures(stateMachines)
    const feature = features["m2"]
    assertContains(feature, 'Given initially s1 "<a>"')
    assertNotContains(feature, 'And initially s1 "<a>"')
    assertMatchesReference(stateMachines, feature)
})

test("[TST-078] → [REQ-118/164]: Source transition not matched when result arguments differ from trigger arguments", () => {
    const stateMachines: StateMachines = [{
        name: "m1",
        states: [{name: "s1"}],
        dataExampleValues: [{a: "1"}],
        transitions: [{
                        trigger: {type: "event", name: "e"},
            result: {name: "s1", arguments: [{name: "a", condition: {operator: "=", value: "1"}}]},
        }],
    }, {
        name: "m2",
        states: [{name: "s2"}],
        transitions: [{
                        trigger: {
                type: "state", name: "s1",
                arguments: [{name: "a", condition: {operator: "=", value: "2"}}],
            },
            result: {name: "s2"},
        }],
    }]
    assertThrowMatchesReference(stateMachines, () => createFeatures(stateMachines),
        "Invalid state machine \"m2\": anonymous transition has an unresolvable state trigger \"s1\" — no source transition's result arguments satisfy the trigger's argument condition(s) (REQ-118/REQ-164).",
    )
})

