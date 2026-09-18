import { describe, it } from "node:test"
import * as assert from "node:assert/strict"

import type { Result, StateMachine } from "../sm.ast.d"
import { validateStateMachines } from "../validate"

function cloneStateMachines(stateMachines: StateMachine[]): StateMachine[] {
    return JSON.parse(JSON.stringify(stateMachines)) as StateMachine[]
}

function buildValidStateMachines(): StateMachine[] {
    return [
        {
            name: "m1",
            states: [{ name: "s1" }, { name: "s2" }],
            defaultPreconditions: [{ state: "s3" }],
            transitions: [
                {
                    id: "001",
                    states: [{ name: "s3" }],
                    trigger: { type: "event", name: "e1" },
                    result: { name: "s2" },
                },
            ],
            dataValueCombinations: [
                { a1: "v1", a2: "1" },
                { a1: "v2", a2: "2" },
                { a1: "v3", a2: "3" },
            ],
        },
        {
            name: "m2",
            states: [{ name: "s3" }, { name: "s4" }],
            transitions: [],
            dataValueCombinations: [{ a1: "v1", a2: "1" }],
        },
    ]
}

describe("validateStateMachines business rules", () => {
    it("[TST-111]: accepts a valid AST", () => {
        const stateMachines = buildValidStateMachines()
        stateMachines[0].data = { a1: "", a2: "" }
        stateMachines[1].data = { a1: "", a2: "" }
        assert.doesNotThrow(() => validateStateMachines(stateMachines))
    })

    it("[TST-112] → [REQ-402]: rejects duplicate state names across machines", () => {
        const stateMachines = buildValidStateMachines()
        stateMachines[1].states.push({ name: "s1" })

        assert.throws(
            () => validateStateMachines(stateMachines),
            /State name `s1` is declared in state machines `m1` and `m2`/,
        )
    })

    it("[TST-113] → [REQ-403]: rejects unknown precondition state references", () => {
        const stateMachines = buildValidStateMachines()
        stateMachines[0].transitions?.[0].states?.push({ name: "s9" })

        assert.throws(
            () => validateStateMachines(stateMachines),
            /Precondition state `s9` is not declared in any state machine/,
        )
    })

    it("[TST-114] → [REQ-404]: rejects unknown state triggers", () => {
        const stateMachines = buildValidStateMachines()
        stateMachines[0].transitions = [
            {
                id: "001",
                trigger: { type: "state", name: "s9" },
                result: { name: "s2" },
            },
        ]

        assert.throws(
            () => validateStateMachines(stateMachines),
            /State trigger `s9` is not declared in any state machine/,
        )
    })

    it("[TST-115] → [REQ-405]: rejects result states that are not owned by the transition machine", () => {
        const stateMachines = buildValidStateMachines()
        if (stateMachines[0].transitions?.[0]) {
            stateMachines[0].transitions[0].result.name = "s3"
        }

        assert.throws(
            () => validateStateMachines(stateMachines),
            /Result state `s3` is not a declared state of this machine/,
        )
    })

    it("[TST-116] → [REQ-406]: rejects state triggers that reference own-machine states", () => {
        const stateMachines = buildValidStateMachines()
        stateMachines[0].transitions = [
            {
                id: "001",
                trigger: { type: "state", name: "s1" },
                result: { name: "s2" },
            },
        ]

        assert.throws(
            () => validateStateMachines(stateMachines),
            /State trigger `s1` belongs to the same state machine/,
        )
    })

    it("[TST-117] → [REQ-407]: rejects duplicate precondition names in one transition", () => {
        const stateMachines = buildValidStateMachines()
        stateMachines[0].transitions = [
            {
                id: "001",
                states: [{ name: "s3" }, { name: "S3" }],
                trigger: { type: "event", name: "e1" },
                result: { name: "s2" },
            },
        ]

        assert.throws(
            () => validateStateMachines(stateMachines),
            /appears more than once in the precondition list/,
        )
    })

    it("[TST-118] → [REQ-408]: rejects two preconditions from the same owning machine", () => {
        const stateMachines = buildValidStateMachines()
        stateMachines[0].transitions = [
            {
                id: "001",
                states: [{ name: "s3" }, { name: "s4" }],
                trigger: { type: "event", name: "e1" },
                result: { name: "s2" },
            },
        ]

        assert.throws(
            () => validateStateMachines(stateMachines),
            /Precondition list contains two states from machine `m2`/,
        )
    })

    it("[TST-119] → [REQ-412]: rejects modifiers without a base reference in the same transition", () => {
        const stateMachines = buildValidStateMachines()
        stateMachines[0].transitions = [
            {
                id: "001",
                states: [{ name: "s3" }],
                trigger: { type: "event", name: "e1", arguments: [{ name: "a1", modifier: "not" }] },
                result: { name: "s2" },
            },
        ]

        assert.throws(
            () => validateStateMachines(stateMachines),
            /Modifier `not` on attribute `a1` has no base reference in this transition/,
        )
    })

    it("[TST-120] → [REQ-413]: rejects sequence modifiers when value pool has fewer than 2 distinct values", () => {
        const stateMachines = cloneStateMachines(buildValidStateMachines())
        stateMachines[0].dataValueCombinations = [{ a1: "v1" }]
        stateMachines[1].dataValueCombinations = [{ a1: "v1" }]
        stateMachines[0].transitions = [
            {
                id: "001",
                states: [{ name: "s3" }],
                trigger: {
                    type: "event",
                    name: "e1",
                    arguments: [{ name: "a1" }, { name: "a1", modifier: "next" }],
                },
                result: { name: "s2" },
            },
        ]

        assert.throws(
            () => validateStateMachines(stateMachines),
            /requires at least 2 distinct values in the values pool, but only `1` was found/,
        )
    })

    it("[TST-121] → [REQ-414]: rejects incremented-like modifiers when value pool contains non-numeric values", () => {
        const stateMachines = cloneStateMachines(buildValidStateMachines())
        stateMachines[0].dataValueCombinations = [{ a2: "1" }, { a2: "x" }]
        stateMachines[1].dataValueCombinations = []
        stateMachines[0].transitions = [
            {
                id: "001",
                states: [{ name: "s3" }],
                trigger: {
                    type: "event",
                    name: "e1",
                    arguments: [{ name: "a2" }, { name: "a2", modifier: "incremented" }],
                },
                result: { name: "s2" },
            },
        ]

        assert.throws(
            () => validateStateMachines(stateMachines),
            /State machine `m1`: Modifier `incremented` on attribute `a2` - value `x` in the values pool is not numeric\./,
        )
    })

    it("[TST-122] → [REQ-415]: rejects an operator field on a result argument's value", () => {
        const stateMachines = cloneStateMachines(buildValidStateMachines())
        stateMachines[0].transitions = [
            {
                id: "001",
                trigger: { type: "event", name: "e1" },
                result: {
                    name: "s2",
                    // `Result` has no `operator` field (REQ-415: a result is always a plain
                    // equality assignment) — the schema rejects it as an unknown property.
                    arguments: [{ name: "a2", result: { operator: ">=", value: "2" } as unknown as Result }],
                },
            },
        ]

        assert.throws(
            () => validateStateMachines(stateMachines),
            /must NOT have additional properties/,
        )
    })
    it("[TST-123] → [REQ-417]: rejects Value combinations tables missing columns for declared attributes", () => {
        const stateMachines = cloneStateMachines(buildValidStateMachines())
        stateMachines[0].data = { a1: "", a2: "" }
        stateMachines[0].dataValueCombinations = [{ a1: "v1" }]

        assert.throws(
            () => validateStateMachines(stateMachines),
            /Value combinations table is missing column\(s\) for declared attribute\(s\): `a2` \(REQ-417\)/,
        )
    })

    it("[TST-124] → [REQ-418]: accepts valid condition values from dataValueCombinations, and undefined operator", () => {
        const stateMachines = cloneStateMachines(buildValidStateMachines())
        stateMachines[0].states[0].impliedConditions = [
            { attribute: "a1", condition: { operator: "=", value: "v1" } },
            { attribute: "a1", condition: { operator: "as", value: "v3" } },
            { attribute: "a1", condition: { operator: "undefined" } },
        ]
        stateMachines[0].transitions = [
            {
                id: "001",
                states: [{ name: "s3", arguments: [{ name: "a1", condition: { operator: "in", value: ["v1", "v2", "v3"] } }] }],
                trigger: { type: "event", name: "e1", arguments: [{ name: "a2", condition: { operator: "in range", value: "[1, 3]" } }] },
                result: { name: "s2", arguments: [{ name: "a1", result: { value: "v2" } }] },
            },
        ]

        assert.doesNotThrow(() => validateStateMachines(stateMachines))
    })


    it("[TST-184] → [REQ-406]: rejects a state trigger whose arguments no producing transition satisfies", () => {
        const stateMachines = cloneStateMachines(buildValidStateMachines())
        stateMachines[0].data = { a1: "" }
        stateMachines[1].data = { a1: "" }
        stateMachines[0].transitions = [
            {
                id: "001",
                states: [{ name: "s1" }],
                trigger: { type: "event", name: "e1" },
                result: { name: "s2", arguments: [{ name: "a1", result: { value: "v1" } }] },
            },
        ]
        stateMachines[1].transitions = [
            {
                id: "002",
                states: [{ name: "s3" }],
                trigger: { type: "state", name: "s2", arguments: [{ name: "a1", condition: { operator: "as", value: "v2" } }] },
                result: { name: "s4" },
            },
        ]

        assert.throws(
            () => validateStateMachines(stateMachines),
            /State trigger `s2` names a state that is produced elsewhere, but no producing transition satisfies the trigger's argument `a1` \(REQ-406\)/,
        )
    })

    it("[TST-185] → [REQ-406]: accepts a state trigger a producing transition satisfies", () => {
        const stateMachines = cloneStateMachines(buildValidStateMachines())
        stateMachines[0].data = { a1: "" }
        stateMachines[1].data = { a1: "" }
        stateMachines[0].transitions = [
            {
                id: "001",
                states: [{ name: "s1" }],
                trigger: { type: "event", name: "e1" },
                result: { name: "s2", arguments: [{ name: "a1", result: { value: "v1" } }] },
            },
        ]
        stateMachines[1].transitions = [
            {
                id: "002",
                states: [{ name: "s3" }],
                trigger: { type: "state", name: "s2", arguments: [{ name: "a1", condition: { operator: "as", value: "v1" } }] },
                result: { name: "s4" },
            },
        ]

        assert.doesNotThrow(() => validateStateMachines(stateMachines))
    })

    it("[TST-125] → [REQ-424/426]: accepts an attribute-reference condition on a precondition state argument", () => {
        const stateMachines = cloneStateMachines(buildValidStateMachines())
        stateMachines[0].data = { a1: "", a2: "" }
        stateMachines[1].data = { a1: "", a2: "" }
        stateMachines[0].transitions![0].states = [
            { name: "s3", arguments: [{ name: "a2", condition: { operator: "=", value: "a1", valueIsReference: true } }] },
        ]

        assert.doesNotThrow(() => validateStateMachines(stateMachines))
    })

    it("[TST-167] → [REQ-424]: rejects an attribute-reference condition value on a set operator", () => {
        const stateMachines = cloneStateMachines(buildValidStateMachines())
        stateMachines[0].data = { a1: "", a2: "" }
        stateMachines[1].data = { a1: "", a2: "" }
        stateMachines[0].transitions![0].trigger = {
            type: "event",
            name: "e1",
            arguments: [{ name: "a2", condition: { operator: "in", value: ["a1"], valueIsReference: true } }],
        }

        assert.throws(
            () => validateStateMachines(stateMachines),
            /but operator `in` compares against fixed literal value\(s\), which an attribute reference cannot provide \(REQ-424\)/,
        )
    })

    it("[TST-168] → [REQ-425]: rejects an attribute-reference condition naming an unknown attribute", () => {
        const stateMachines = cloneStateMachines(buildValidStateMachines())
        stateMachines[0].data = { a1: "", a2: "" }
        stateMachines[1].data = { a1: "", a2: "" }
        stateMachines[0].states[0].impliedConditions = [
            { attribute: "a1", condition: { operator: "as", value: "a9", valueIsReference: true } },
        ]

        assert.throws(
            () => validateStateMachines(stateMachines),
            /Argument `a1` references attribute `a9`, but no state machine declares a data attribute by the name `a9` \(REQ-425\)/,
        )
    })

    it("[TST-126] → [REQ-424/423]: accepts an attribute-reference result value on a result argument", () => {
        const stateMachines = cloneStateMachines(buildValidStateMachines())
        stateMachines[0].data = { a1: "", a2: "" }
        stateMachines[1].data = { a1: "", a2: "" }
        stateMachines[0].transitions![0].result = {
            name: "s2",
            arguments: [{ name: "a2", result: { value: "a1", valueIsReference: true } }],
        }

        assert.doesNotThrow(() => validateStateMachines(stateMachines))
    })

    it("[TST-165] → [REQ-425]: rejects an attribute-reference result value naming an unknown attribute", () => {
        const stateMachines = cloneStateMachines(buildValidStateMachines())
        stateMachines[0].data = { a1: "", a2: "" }
        stateMachines[1].data = { a1: "", a2: "" }
        stateMachines[0].transitions![0].result = {
            name: "s2",
            arguments: [{ name: "a2", result: { value: "a3", valueIsReference: true } }],
        }

        assert.throws(
            () => validateStateMachines(stateMachines),
            /Argument `a2` references attribute `a3`, but no state machine declares a data attribute by the name `a3` \(REQ-425\)/,
        )
    })

    it("[TST-166] → [REQ-425]: accepts an attribute-reference result value naming an attribute of another machine", () => {
        const stateMachines = cloneStateMachines(buildValidStateMachines())
        stateMachines[0].data = { a1: "" }
        stateMachines[1].data = { a3: "" }
        stateMachines[1].dataValueCombinations = [{ a3: "v1" }]
        stateMachines[0].transitions![0].result = {
            name: "s2",
            arguments: [{ name: "a1", result: { value: "a3", valueIsReference: true } }],
        }

        assert.doesNotThrow(() => validateStateMachines(stateMachines))
    })

    it("[TST-177] → [REQ-433]: rejects a result leaving an attribute undefined that the target state declares defined", () => {
        const stateMachines = cloneStateMachines(buildValidStateMachines())
        stateMachines[0].states = [
            { name: "s1", impliedConditions: [{ attribute: "a1", condition: { operator: "undefined" } }] },
            { name: "s2", impliedConditions: [{ attribute: "a1", condition: { operator: "defined" } }] },
        ]
        stateMachines[0].transitions![0].states = [{ name: "s1" }]

        assert.throws(
            () => validateStateMachines(stateMachines),
            /transition `001` results in `s2`, which declares `a1` defined, but the transition does not set it and leaves it undefined \(carried over from `s1`\).*\(REQ-433\)/s,
        )
    })

    it("[TST-178] → [REQ-433]: accepts the same transition once its result sets the attribute", () => {
        const stateMachines = cloneStateMachines(buildValidStateMachines())
        stateMachines[0].states = [
            { name: "s1", impliedConditions: [{ attribute: "a1", condition: { operator: "undefined" } }] },
            { name: "s2", impliedConditions: [{ attribute: "a1", condition: { operator: "defined" } }] },
        ]
        stateMachines[0].transitions![0].states = [{ name: "s1" }]
        stateMachines[0].transitions![0].result = {
            name: "s2",
            arguments: [{ name: "a1", result: { value: "v1" } }],
        }

        assert.doesNotThrow(() => validateStateMachines(stateMachines))
    })

    it("[TST-179] → [REQ-433]: rejects a result setting an attribute the target state declares undefined", () => {
        const stateMachines = cloneStateMachines(buildValidStateMachines())
        stateMachines[0].states = [
            { name: "s1" },
            { name: "s2", impliedConditions: [{ attribute: "a1", condition: { operator: "undefined" } }] },
        ]
        stateMachines[0].transitions![0].result = {
            name: "s2",
            arguments: [{ name: "a1", result: { value: "v1" } }],
        }

        assert.throws(
            () => validateStateMachines(stateMachines),
            /results in `s2`, which declares `a1` undefined, but the transition's own result sets it to "v1".*\(REQ-433\)/s,
        )
    })

    it("[TST-180] → [REQ-433]: reports nothing when no precondition settles the attribute", () => {
        const stateMachines = cloneStateMachines(buildValidStateMachines())
        stateMachines[0].states = [
            { name: "s1" },
            { name: "s2", impliedConditions: [{ attribute: "a1", condition: { operator: "defined" } }] },
        ]
        stateMachines[0].transitions![0].states = [{ name: "s1" }]

        assert.doesNotThrow(() => validateStateMachines(stateMachines))
    })

    it("[TST-181] → [REQ-433]: a sameness to another attribute on the target state is never owed", () => {
        const stateMachines = cloneStateMachines(buildValidStateMachines())
        stateMachines[0].data = { a1: "", a2: "" }
        stateMachines[0].states = [
            { name: "s1", impliedConditions: [{ attribute: "a1", condition: { operator: "undefined" } }] },
            {
                name: "s2",
                impliedConditions: [
                    { attribute: "a1", condition: { operator: "as", value: "a2", valueIsReference: true } },
                ],
            },
        ]
        stateMachines[0].transitions![0].states = [{ name: "s1" }]

        assert.doesNotThrow(() => validateStateMachines(stateMachines))
    })

    it("[TST-233] → [REQ-443]: rejects a condition-shaped suffix on a result argument", () => {
        const stateMachines = cloneStateMachines(buildValidStateMachines())
        // `a1` as "v1" in a result position matches no result rule, so the grammar hands it to
        // the argument's free-text suffix, where it constrains nothing.
        stateMachines[0].transitions![0].result.arguments = [{ name: "a1", suffix: 'as "v1"' }]

        assert.throws(
            () => validateStateMachines(stateMachines),
            /result argument `a1` carries `as "v1"`[\s\S]*REQ-443/,
        )
    })

    it("[TST-234] → [REQ-443]: accepts a descriptive suffix that merely opens with an operator word", () => {
        const stateMachines = cloneStateMachines(buildValidStateMachines())
        stateMachines[0].transitions![0].result.arguments = [{ name: "a1", suffix: "as shown" }]

        assert.doesNotThrow(() => validateStateMachines(stateMachines))
    })

    it("[TST-235] → [REQ-443]: reports every condition-shaped result suffix at once", () => {
        const stateMachines = cloneStateMachines(buildValidStateMachines())
        stateMachines[0].transitions!.push({
            id: "002",
            trigger: { type: "event", name: "e2" },
            result: { name: "s2", arguments: [{ name: "a2", suffix: ">= 2" }] },
        })
        stateMachines[0].transitions![0].result.arguments = [{ name: "a1", suffix: 'is "v1"' }]

        assert.throws(() => validateStateMachines(stateMachines), (error: Error) => {
            assert.match(error.message, /`001`[\s\S]*`a1`/)
            assert.match(error.message, /`002`[\s\S]*`a2`/)
            return true
        })
    })

    it("[TST-238] → [REQ-433]: rejects a carried-over value contradicting the target state's `as` literal", () => {
        const stateMachines = cloneStateMachines(buildValidStateMachines())
        stateMachines[0].states = [
            { name: "s1", impliedConditions: [{ attribute: "a1", condition: { operator: "as", value: "v1" } }] },
            { name: "s2", impliedConditions: [{ attribute: "a1", condition: { operator: "as", value: "v2" } }] },
        ]
        stateMachines[0].transitions![0].states = [{ name: "s1" }]

        assert.throws(
            () => validateStateMachines(stateMachines),
            /results in `s2`, which declares `a1` as "v2", but the transition does not set it and sets it to "v1" \(carried over from `s1`\).*\(REQ-433\)/s,
        )
    })

    it("[TST-239] → [REQ-433]: rejects a result contradicting the target state's `as` literal", () => {
        const stateMachines = cloneStateMachines(buildValidStateMachines())
        stateMachines[0].states = [
            { name: "s1" },
            { name: "s2", impliedConditions: [{ attribute: "a1", condition: { operator: "as", value: "v2" } }] },
        ]
        stateMachines[0].transitions![0].result.arguments = [{ name: "a1", result: { value: "v3" } }]

        assert.throws(
            () => validateStateMachines(stateMachines),
            /declares `a1` as "v2", but the transition's own result sets it to "v3".*\(REQ-433\)/s,
        )
    })

    it("[TST-244] → [REQ-433]: rejects a result contradicting the target state's `=` literal", () => {
        const stateMachines = cloneStateMachines(buildValidStateMachines())
        stateMachines[0].states = [
            { name: "s1" },
            { name: "s2", impliedConditions: [{ attribute: "a1", condition: { operator: "=", value: "v2" } }] },
        ]
        stateMachines[0].transitions![0].result.arguments = [{ name: "a1", result: { value: "v3" } }]

        assert.throws(
            () => validateStateMachines(stateMachines),
            /declares `a1` = "v2", but the transition's own result sets it to "v3".*\(REQ-433\)/s,
        )
    })

    it("[TST-240] → [REQ-433]: accepts a result assigning the target state's `as` literal", () => {
        const stateMachines = cloneStateMachines(buildValidStateMachines())
        stateMachines[0].states = [
            { name: "s1", impliedConditions: [{ attribute: "a1", condition: { operator: "as", value: "v1" } }] },
            { name: "s2", impliedConditions: [{ attribute: "a1", condition: { operator: "as", value: "v2" } }] },
        ]
        stateMachines[0].transitions![0].states = [{ name: "s1" }]
        stateMachines[0].transitions![0].result.arguments = [{ name: "a1", result: { value: "v2" } }]

        assert.doesNotThrow(() => validateStateMachines(stateMachines))
    })
})
