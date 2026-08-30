import * as assert from "node:assert/strict"
import { assertContains, assertNotContains, createFixtures, createSteps, test } from "./utils"
import { StateMachines } from "../../parse"

test("[TST-101] → [REQ-229/230/231/232]: When pattern shared by two state machines is written once to shared.steps.js", () => {
    const stateMachines: StateMachines = [{
        name: "m1",
        states: [{ name: "s1" }],
        transitions: [{ trigger: { type: "event", name: "e1" }, result: { name: "s1" } }],
    }, {
        name: "m2",
        states: [{ name: "s2" }],
        transitions: [{ trigger: { type: "event", name: "e1" }, result: { name: "s2" } }],
    }]

    const steps = createSteps(stateMachines)
    assert.ok("shared.steps.js" in steps, "shared.steps.js must be generated")
    assertContains(steps["shared.steps.js"], "When('e1'")
    assertNotContains(steps["m1.steps.js"], "When('e1'")
    assertNotContains(steps["m2.steps.js"], "When('e1'")
})

test("[TST-102] → [REQ-230]: When pattern used by only one state machine stays in its own file", () => {
    const stateMachines: StateMachines = [{
        name: "m1",
        states: [{ name: "s1" }],
        transitions: [{ trigger: { type: "event", name: "e2" }, result: { name: "s1" } }],
    }, {
        name: "m2",
        states: [{ name: "s2" }],
        transitions: [{ trigger: { type: "event", name: "e3" }, result: { name: "s2" } }],
    }]

    const steps = createSteps(stateMachines)
    assert.ok(!("shared.steps.js" in steps), "shared.steps.js must not be generated when nothing is shared")
    assertContains(steps["m1.steps.js"], "When('e2'")
    assertContains(steps["m2.steps.js"], "When('e3'")
})

test("[TST-103] → [REQ-233]: shared step file contains only a When section, imported accordingly", () => {
    const stateMachines: StateMachines = [{
        name: "m1",
        states: [{ name: "s1" }],
        transitions: [{ trigger: { type: "event", name: "e1" }, result: { name: "s1" } }],
    }, {
        name: "m2",
        states: [{ name: "s2" }],
        transitions: [{ trigger: { type: "event", name: "e1" }, result: { name: "s2" } }],
    }]

    const shared = createSteps(stateMachines)["shared.steps.js"]
    assertContains(shared, "// --- When ---")
    assertNotContains(shared, "// --- Given ---")
    assertNotContains(shared, "// --- Then ---")
    assertContains(shared, "import { When } from '../utils'")
})

test("[TST-104] → [REQ-235]: shared step definition lists deduplicated transition ids from every contributing state machine", () => {
    const stateMachines: StateMachines = [{
        name: "m1",
        states: [{ name: "s1" }],
        transitions: [{
            id: "001",
            trigger: { type: "event", name: "e1" },
            result: { name: "s1" },
        }],
    }, {
        name: "m2",
        states: [{ name: "s2" }],
        transitions: [{
            id: "002",
            trigger: { type: "event", name: "e1" },
            result: { name: "s2" },
        }],
    }]

    const shared = createSteps(stateMachines)["shared.steps.js"]
    assertContains(shared, "// 001, 002")
})

test("[TST-105] → [REQ-318/319/320]: When fixture shared by two state machines is written once to shared.fixtures.js", () => {
    const stateMachines: StateMachines = [{
        name: "m1",
        states: [{ name: "s1" }],
        transitions: [{ trigger: { type: "event", name: "e1" }, result: { name: "s1" } }],
    }, {
        name: "m2",
        states: [{ name: "s2" }],
        transitions: [{ trigger: { type: "event", name: "e1" }, result: { name: "s2" } }],
    }]

    const fixtures = createFixtures(stateMachines)
    assert.ok("shared.fixtures.js" in fixtures, "shared.fixtures.js must be generated")
    assertContains(fixtures["shared.fixtures.js"], "export async function makeE1({ page })")
    assertNotContains(fixtures["m1.fixtures.js"], "makeE1")
    assertNotContains(fixtures["m2.fixtures.js"], "makeE1")
})

test("[TST-106] → [REQ-322]: fixture index re-exports the shared fixture file only when one is generated", () => {
    const shared: StateMachines = [{
        name: "m1",
        states: [{ name: "s1" }],
        transitions: [{ trigger: { type: "event", name: "e1" }, result: { name: "s1" } }],
    }, {
        name: "m2",
        states: [{ name: "s2" }],
        transitions: [{ trigger: { type: "event", name: "e1" }, result: { name: "s2" } }],
    }]
    assertContains(createFixtures(shared)["index.js"], "export * from './shared.fixtures.js'")

    const notShared: StateMachines = [{
        name: "m1",
        states: [{ name: "s1" }],
        transitions: [{ trigger: { type: "event", name: "e2" }, result: { name: "s1" } }],
    }]
    const fixtures = createFixtures(notShared)
    assert.ok(!("shared.fixtures.js" in fixtures), "shared.fixtures.js must not be generated when nothing is shared")
    assertNotContains(fixtures["index.js"], "shared.fixtures.js")
})
