import { strict as assert } from "node:assert"
import { assertContains, assertNotContains, assertMatchesReference, createFeatures, test, } from "./utils"
import { type StateMachines, validateStateMachines } from "../../parse"

/**
 * Validate a state-machine set and hand it back, so a test can build and validate one inline.
 *
 * @param stateMachines State machines to validate.
 * @returns The same state machines.
 */
function validated(stateMachines: StateMachines): StateMachines {
    validateStateMachines(stateMachines)
    return stateMachines
}

test("[TST-228] → [REQ-442/436/047]: Result argument pinned undefined by its result state is not rendered", () => {
    const stateMachines: StateMachines = [{
        name: "m",
        states: [
            {name: "s1"},
            // `s2` pins `a` to undefined on every occurrence, so the result argument below
            // asserts only what the state name already says (REQ-442).
            {name: "s2", impliedConditions: [{attribute: "a", condition: {operator: "undefined"}}]},
        ],
        dataValueCombinations: [{a: ""}, {a: "1"}],
        transitions: [{
            states: [{name: "s1"}],
            trigger: {type: "event", name: "e"},
            result: {name: "s2", arguments: [{name: "a", result: {}}]},
            notes: "",
        }],
    }]
    validateStateMachines(stateMachines)
    const feature = createFeatures(stateMachines)["m"]
    assertContains(feature, "    Then expect s2\n")
    assertNotContains(feature, "resulting a")
    // No column survives, so the scenario is plain and carries no examples table (REQ-436/REQ-047).
    assertContains(feature, "  Scenario: ")
    assertNotContains(feature, "Scenario Outline")
    assertNotContains(feature, "Examples:")
    assertMatchesReference(stateMachines, feature)
})

test("[TST-229] → [REQ-442]: An authored `set to undefined` renders like the synthesized one", () => {
    const stateMachines: StateMachines = [{
        name: "m",
        states: [
            {name: "s1"},
            {name: "s2", impliedConditions: [{attribute: "a", condition: {operator: "undefined"}}]},
        ],
        dataValueCombinations: [{a: ""}, {a: "1"}],
        transitions: [
            {
                id: "authored",
                states: [{name: "s1"}],
                trigger: {type: "event", name: "e1"},
                // Written out by the author, qualifier and all.
                result: {name: "s2", arguments: [{name: "a", qualifier: "with", result: {}}]},
                notes: "",
            },
            {
                id: "synthesized",
                states: [{name: "s1"}],
                trigger: {type: "event", name: "e2"},
                // As completion leaves it (REQ-434): no qualifier to render.
                result: {name: "s2", arguments: [{name: "a", result: {}}]},
                notes: "",
            },
        ],
    }]
    validateStateMachines(stateMachines)
    const feature = createFeatures(stateMachines)["m"]
    // Both spellings collapse onto the same step: the qualifier has nothing left to qualify.
    assertNotContains(feature, "expect s2 with")
    assertContains(feature, "    When e1\n    Then expect s2\n")
    assertContains(feature, "    When e2\n    Then expect s2\n")
    assertMatchesReference(stateMachines, feature)
})

test("[TST-230] → [REQ-442/436]: Suppressing a result argument removes no example row", () => {
    // Same model twice, differing only in the implied condition that triggers suppression: the
    // rows the scenario keeps must not depend on it, since filters are collected from the
    // transition and its chain, never from the rendered columns.
    const build = (pinned: boolean): StateMachines => [{
        name: "m",
        states: [
            {name: "s1"},
            pinned
                ? {name: "s2", impliedConditions: [{attribute: "b", condition: {operator: "undefined"}}]}
                : {name: "s2"},
        ],
        dataValueCombinations: [{a: "1", b: ""}, {a: "2", b: ""}, {a: "3", b: ""}],
        transitions: [{
            states: [{name: "s1", arguments: [{name: "a", condition: {operator: ">", value: "1"}}]}],
            trigger: {type: "event", name: "e"},
            result: {name: "s2", arguments: [{name: "b", result: {}}]},
            notes: "",
        }],
    }]

    /** The values the rendered examples table holds for column `a`, in row order. */
    const columnValues = (feature: string, column: string): string[] => {
        const rows = feature.split("\n")
            .filter((line) => line.trim().startsWith("|"))
            .map((line) => line.trim().split("|").slice(1, -1).map((cell) => cell.trim()))
        const index = rows[0].indexOf(column)
        return rows.slice(1).map((cells) => cells[index])
    }

    const suppressed = createFeatures(validated(build(true)))["m"]
    const rendered = createFeatures(validated(build(false)))["m"]

    assertNotContains(suppressed, "resulting b")
    assertContains(rendered, "resulting b")
    // The precondition filters `a` down to the same rows either way: suppression drops a column,
    // never a row.
    assert.deepEqual(columnValues(suppressed, "a"), columnValues(rendered, "a"))
    assertMatchesReference(build(true), suppressed)
})

test("[TST-231] → [REQ-442]: A suppressed result still binds a state trigger to undefined", () => {
    const stateMachines: StateMachines = [
        {
            name: "m1",
            states: [
                {name: "s1"},
                {name: "s2", impliedConditions: [{attribute: "a", condition: {operator: "undefined"}}]},
            ],
            dataValueCombinations: [{a: ""}, {a: "1"}],
            transitions: [{
                states: [{name: "s1", arguments: [{name: "a"}]}],
                trigger: {type: "event", name: "e"},
                result: {name: "s2", arguments: [{name: "a", result: {}}]},
                notes: "",
            }],
        },
        {
            name: "m2",
            states: [{name: "s3"}, {name: "s4"}],
            dataValueCombinations: [{c: ""}, {c: "9"}],
            transitions: [{
                states: [{name: "s3"}],
                trigger: {type: "state", name: "s2", arguments: [{name: "a"}]},
                result: {name: "s4", arguments: [{name: "c", result: {value: "a", valueIsReference: true}}]},
                notes: "",
            }],
        },
    ]
    validateStateMachines(stateMachines)
    const feature = createFeatures(stateMachines)["m2"]
    // `m1`'s own result step is suppressed, but the argument stays in the AST, so `c` still reads
    // the value that result produced — undefined — in the row where `a` held `1` before the event.
    // A binding lost with the rendering would show `| 1 | 1 |` here instead.
    assertContains(feature, "    Then expect s2\n")
    assertContains(feature, "      | a | resulting c |\n      |   |             |\n      | 1 |             |")
    assertMatchesReference(stateMachines, feature)
})

test("[TST-236] → [REQ-442/436/047]: Result argument assigning its result state's `=` literal is not rendered", () => {
    const stateMachines: StateMachines = validated([{
        name: "m",
        states: [
            {name: "s1", impliedConditions: [{attribute: "n", condition: {operator: ">", value: "0"}}]},
            // `s2` pins `n` to the single literal `0`, so `resulting n` holds `0` in every row.
            {name: "s2", impliedConditions: [{attribute: "n", condition: {operator: "=", value: "0"}}]},
        ],
        dataValueCombinations: [{n: "0"}, {n: "1"}, {n: "2"}],
        transitions: [{
            states: [{name: "s1", arguments: [{name: "n"}]}],
            trigger: {type: "event", name: "e"},
            result: {name: "s2", arguments: [{name: "n", result: {value: "0"}}]},
            notes: "",
        }],
    }])
    const feature = createFeatures(stateMachines)["m"]
    assertContains(feature, "    Then expect s2\n")
    assertNotContains(feature, "resulting n")
    // The precondition's own `n` column still varies, so it keeps its rows.
    assertContains(feature, "      | n |\n      | 1 |")
    assertMatchesReference(stateMachines, feature)
})

test("[TST-237] → [REQ-442]: A result literal contradicting its result state's `=` pin stays rendered (validation would reject this input; not exercised here)", () => {
    const stateMachines: StateMachines = [{
        name: "m",
        states: [
            {name: "s1"},
            {name: "s2", impliedConditions: [{attribute: "n", condition: {operator: "=", value: "0"}}]},
        ],
        dataValueCombinations: [{n: "0"}, {n: "1"}],
        transitions: [{
            states: [{name: "s1"}],
            trigger: {type: "event", name: "e"},
            result: {name: "s2", arguments: [{name: "n", qualifier: "with", result: {value: "1"}}]},
            notes: "",
        }],
    }]
    // Rendering only: whether the contradiction is an error is REQ-433's call, not this rule's.
    const feature = createFeatures(stateMachines)["m"]
    assertContains(feature, 'Then expect s2 with "<resulting n>"')
    assertMatchesReference(stateMachines, feature)
})
