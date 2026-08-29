import * as assert from "node:assert/strict"
import { assertContains, createFixtures, createSteps, test } from "./utils"
import { StateMachines } from "../../parse"

test("[TST-087] → [REQ-206/207/208/210/211]: step file groups, sorts and deduplicates step registrations", () => {
    const stateMachines: StateMachines = [{
        name: "m",
        states: [{ name: "s1" }, { name: "s2" }],
        transitions: [
            {
                id: "022",
                states: [{ name: "s2" }],
                trigger: { type: "event", name: "e1" },
                result: { name: "s1" },
            },
            {
                id: "021",
                states: [{ name: "s1" }],
                trigger: { type: "event", name: "e2" },
                result: { name: "s2" },
            },
            {
                id: "023",
                states: [{ name: "s1" }],
                trigger: { type: "event", name: "e2" },
                result: { name: "s2" },
            },
        ],
    }]

    const stepsFile = createSteps(stateMachines)["m.steps.js"]

    assert.ok(stepsFile.indexOf("// --- Given ---") < stepsFile.indexOf("// --- When ---"))
    assert.ok(stepsFile.indexOf("// --- When ---") < stepsFile.indexOf("// --- Then ---"))
    assertContains(stepsFile, "// 021, 023")
    assert.ok(stepsFile.indexOf("Given('initially s1'") < stepsFile.indexOf("Given('initially s2'"))
    assert.ok(stepsFile.indexOf("When('e1'") < stepsFile.indexOf("When('e2'"))
    assert.ok(stepsFile.indexOf("Then('expect s1'") < stepsFile.indexOf("Then('expect s2'"))
})

test("[TST-088] → [REQ-214/215/216/217/218/219/227]: parameterized steps carry camelCase params into the fixture call", () => {
    const stateMachines: StateMachines = [{
        name: "m",
        states: [{ name: "sa bc" }],
        dataExampleValues: [{ "aa bc": "A" }],
        transitions: [{
            trigger: { type: "event", name: "e", arguments: [{ name: "aa bc" }] },
            result: { name: "sa bc" },
        }],
    }]

    const steps = createSteps(stateMachines)["m.steps.js"]
    assertContains(steps, "Given('initially sa bc', async ({ page }) => {")
    assertContains(steps, "await fixtures.setSaBc({ page })")
    assertContains(steps, "When('e {string}', async ({ page }, aaBc) => {")
    assertContains(steps, "await fixtures.makeE({ page }, aaBc)")
    assertContains(steps, "Then('expect sa bc', async ({ page }) => {")
    assertContains(steps, "await fixtures.expectSaBc({ page })")

    const fixtures = createFixtures(stateMachines)
    assertContains(fixtures["index.js"], "export * from './m.fixtures.js'")
    assertContains(fixtures["m.fixtures.js"], "export async function setSaBc({ page })")
    assertContains(fixtures["m.fixtures.js"], "export async function makeE({ page }, aaBc)")
    assertContains(fixtures["m.fixtures.js"], "export async function expectSaBc({ page })")
})

test("[TST-089] → [REQ-201/202/203]: fixture files use kebab-case names and index exports", () => {
    const stateMachines: StateMachines = [{
        name: "m 1",
        states: [{ name: "s1" }],
        transitions: [{
            trigger: { type: "event", name: "e1" },
            result: { name: "s1" },
        }],
    }, {
        name: "m 2",
        states: [{ name: "s2" }],
        transitions: [{
            trigger: { type: "event", name: "e2" },
            result: { name: "s2" },
        }],
    }]

    const fixtures = createFixtures(stateMachines)
    assert.deepStrictEqual(
        Object.keys(fixtures).sort(),
        ["index.js", "m-1.fixtures.js", "m-2.fixtures.js"],
    )
    assertContains(fixtures["index.js"], "export * from './m-1.fixtures.js'")
    assertContains(fixtures["index.js"], "export * from './m-2.fixtures.js'")
})

test("[TST-090] → [REQ-214/215/216/217/313]: parameterized steps and fixtures handle multiple parameters", () => {
    const stateMachines: StateMachines = [{
        name: "m",
        states: [{ name: "s" }],
        dataExampleValues: [{ "aa bc": "A", "ad ef": "D" }],
        transitions: [{
            trigger: { type: "event", name: "e", arguments: [{ name: "aa bc" }, { name: "ad ef" }] },
            result: { name: "s" },
        }],
    }]

    const steps = createSteps(stateMachines)["m.steps.js"]
    assertContains(steps, "When('e {string}, {string}', async ({ page }, aaBc, adEf) => {")
    assertContains(steps, "await fixtures.makeE({ page }, aaBc, adEf)")

    const fixtures = createFixtures(stateMachines)
    assertContains(fixtures["m.fixtures.js"], "export async function makeE({ page }, aaBc, adEf)")
})

test("[TST-091] → [REQ-204/205]: step file contains required imports", () => {
    const stateMachines: StateMachines = [{
        name: "m",
        states: [{ name: "s" }],
        transitions: [{ trigger: { type: "event", name: "e" }, result: { name: "s" } }],
    }]

    const steps = createSteps(stateMachines)["m.steps.js"]
    assertContains(steps, "import { Given, When, Then } from '../utils'")
    assertContains(steps, "import * as fixtures from '../fixtures/index.js'")
})

test("[TST-092] → [REQ-220]: step file does not emit And as a top-level keyword", () => {
    const stateMachines: StateMachines = [{
        name: "m",
        states: [{ name: "s1" }, { name: "s2" }],
        transitions: [
            { trigger: { type: "event", name: "e" }, result: { name: "s1" } },
            { trigger: { type: "event", name: "e" }, result: { name: "s2" } },
        ],
    }]

    const steps = createSteps(stateMachines)["m.steps.js"]
    assert.ok(!steps.includes("And("), "step file must not contain And(")
})

test("[TST-093] → [REQ-226]: step file only emits steps belonging to its own state machine", () => {
    const stateMachines: StateMachines = [{
        name: "m1",
        states: [{ name: "s1" }],
        transitions: [{ trigger: { type: "event", name: "e1" }, result: { name: "s1" } }],
    }, {
        name: "m2",
        states: [{ name: "s2" }],
        transitions: [{ trigger: { type: "event", name: "e2" }, result: { name: "s2" } }],
    }]

    const steps = createSteps(stateMachines)
    assert.ok(!steps["m1.steps.js"].includes("s2"), "m1 steps must not references m2 states/events")
    assert.ok(!steps["m2.steps.js"].includes("s1"), "m2 steps must not references m1 states/events")
})

test("[TST-094] → [REQ-227/228]: step file ends with a trailing newline and output is deterministic", () => {
    const stateMachines: StateMachines = [{
        name: "m",
        states: [{ name: "s1" }, { name: "s2" }],
        transitions: [
            { trigger: { type: "event", name: "e1" }, result: { name: "s2" } },
            { trigger: { type: "event", name: "e2" }, result: { name: "s1" } },
        ],
    }]

    const first = createSteps(stateMachines)["m.steps.js"]
    const second = createSteps(stateMachines)["m.steps.js"]
    assert.ok(first.endsWith("\n"), "step file must end with a trailing newline")
    assert.strictEqual(first, second, "step file output must be deterministic")
})

test("[TST-095] → [REQ-306/307]: fixture file contains sections in order Set, Make, Expect with correct headers", () => {
    const stateMachines: StateMachines = [{
        name: "m",
        states: [{ name: "s" }],
        transitions: [{ trigger: { type: "event", name: "e" }, result: { name: "s" } }],
    }]

    const fixture = createFixtures(stateMachines)["m.fixtures.js"]
    assertContains(fixture, "// --- Set (Given) ---")
    assertContains(fixture, "// --- Make (When) ---")
    assertContains(fixture, "// --- Expect (Then) ---")
    assert.ok(fixture.indexOf("// --- Set (Given) ---") < fixture.indexOf("// --- Make (When) ---"))
    assert.ok(fixture.indexOf("// --- Make (When) ---") < fixture.indexOf("// --- Expect (Then) ---"))
})

test("[TST-096] → [REQ-308]: fixture stubs are sorted alphabetically within each section", () => {
    const stateMachines: StateMachines = [{
        name: "m",
        states: [{ name: "s1" }, { name: "s2" }],
        transitions: [
            { trigger: { type: "event", name: "e2" }, result: { name: "s2" } },
            { trigger: { type: "event", name: "e1" }, result: { name: "s1" } },
        ],
    }]

    const fixture = createFixtures(stateMachines)["m.fixtures.js"]
    assert.ok(fixture.indexOf("makeE1") < fixture.indexOf("makeE2"), "Make stubs must be sorted alphabetically")
    assert.ok(fixture.indexOf("expectS1") < fixture.indexOf("expectS2"), "Expect stubs must be sorted alphabetically")
})

test("[TST-097] → [REQ-309/310]: fixture deduplicates stubs and keeps the widest parameter list", () => {
    const stateMachines: StateMachines = [{
        name: "m",
        states: [{ name: "s1" }, { name: "s2" }],
        dataExampleValues: [{ "a1": "A", "a2": "B" }],
        transitions: [
            {
                trigger: { type: "event", name: "e", arguments: [{ name: "a1" }] },
                result: { name: "s1" },
            },
            {
                trigger: { type: "event", name: "e", arguments: [{ name: "a1" }, { name: "a2" }] },
                result: { name: "s2" },
            },
        ],
    }]

    const fixture = createFixtures(stateMachines)["m.fixtures.js"]
    assertContains(fixture, "export async function makeE({ page }, a1, a2)")
    const occurrences = (fixture.match(/function makeE\b/g) ?? []).length
    assert.strictEqual(occurrences, 1, "makeE must appear exactly once")
})

test("[TST-098] → [REQ-312]: fixture stubs contain TODO comment and console.log", () => {
    const stateMachines: StateMachines = [{
        name: "m",
        states: [{ name: "s" }],
        transitions: [{ trigger: { type: "event", name: "e" }, result: { name: "s" } }],
    }]

    const fixture = createFixtures(stateMachines)["m.fixtures.js"]
    assertContains(fixture, "// TODO: Implement.")
    assertContains(fixture, 'console.log("NOT IMPLEMENTED:')
})

test("[TST-099] → [REQ-315/316/317]: fixture file only emits stubs for its own machine, ends with newline, and is deterministic", () => {
    const stateMachines: StateMachines = [{
        name: "m1",
        states: [{ name: "s1" }],
        transitions: [{ trigger: { type: "event", name: "e1" }, result: { name: "s1" } }],
    }, {
        name: "m2",
        states: [{ name: "s2" }],
        transitions: [{ trigger: { type: "event", name: "e2" }, result: { name: "s2" } }],
    }]

    const first = createFixtures(stateMachines)
    const second = createFixtures(stateMachines)
    assert.ok(!first["m1.fixtures.js"].includes("s2"), "m1 fixtures must not references m2")
    assert.ok(!first["m2.fixtures.js"].includes("s1"), "m2 fixtures must not references m1")
    assert.ok(first["m1.fixtures.js"].endsWith("\n"), "fixture file must end with a trailing newline")
    assert.strictEqual(first["m1.fixtures.js"], second["m1.fixtures.js"], "fixture output must be deterministic")
})

