/**
 * Tests for `writeFixtureFiles`'s on-disk create-or-append behavior
 * (REQ-446 up to REQ-450 in `docs/smtt.generate.fixtures.md`).
 */

import * as assert from "node:assert/strict"
import * as fs from "fs"
import * as os from "os"
import * as path from "path"
import { assertContains, test } from "./utils"
import { type StateMachines, validateStateMachines } from "../../parse"
import { buildFeatures } from "../features"
import { writeFixtureFiles } from "../fixtures"

/** Run `writeFixtureFiles` for the given state machines into `fixturesDir`. */
function generateFixtures(stateMachines: StateMachines, fixturesDir: string): void {
    validateStateMachines(stateMachines)
    const features = buildFeatures(stateMachines)
    writeFixtureFiles(features, fixturesDir)
}

test("[TST-246] → [REQ-446]: writeFixtureFiles creates a fixture file with full content when it does not yet exist", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "smtt-fixtures-write-test-"))
    try {
        const stateMachines: StateMachines = [{
            name: "m",
            states: [{ name: "s" }],
            transitions: [{ trigger: { type: "event", name: "e" }, result: { name: "s" } }],
        }]

        generateFixtures(stateMachines, tmpDir)

        const content = fs.readFileSync(path.join(tmpDir, "m.fixtures.js"), "utf8")
        assertContains(content, "export async function makeE({ page })")
        assertContains(content, "export async function expectS({ page })")
    } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true })
    }
})

test("[TST-247] → [REQ-447]: writeFixtureFiles never touches an existing fixture file's manual implementation", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "smtt-fixtures-write-test-"))
    try {
        const stateMachines: StateMachines = [{
            name: "m",
            states: [{ name: "s" }],
            transitions: [{ trigger: { type: "event", name: "e" }, result: { name: "s" } }],
        }]

        const filePath = path.join(tmpDir, "m.fixtures.js")
        const handWritten = "import { click } from \"../helpers/click.js\"\n\n" +
            "export async function setS({ page }) {\n    await click(page, \"#reset\")\n}\n\n" +
            "export async function makeE({ page }) {\n    await click(page, \"#e\")\n}\n\n" +
            "export async function expectS({ page }) {\n    await click(page, \"#s\")\n}\n"
        fs.writeFileSync(filePath, handWritten, "utf8")

        generateFixtures(stateMachines, tmpDir)

        const content = fs.readFileSync(filePath, "utf8")
        assert.strictEqual(content, handWritten, "existing manual implementation must be left byte-for-byte unchanged")
    } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true })
    }
})

test("[TST-248] → [REQ-448/449]: writeFixtureFiles appends only missing stubs under a TODO marker, preserving existing content", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "smtt-fixtures-write-test-"))
    try {
        const stateMachines: StateMachines = [{
            name: "m",
            states: [{ name: "s1" }, { name: "s2" }],
            transitions: [
                { trigger: { type: "event", name: "e1" }, result: { name: "s1" } },
                { trigger: { type: "event", name: "e2" }, result: { name: "s2" } },
            ],
        }]

        const filePath = path.join(tmpDir, "m.fixtures.js")
        const handWritten = "export async function makeE1({ page }) {\n    // done by hand\n}\n"
        fs.writeFileSync(filePath, handWritten, "utf8")

        generateFixtures(stateMachines, tmpDir)

        const content = fs.readFileSync(filePath, "utf8")
        assertContains(content, handWritten)
        assertContains(content, "// --- TODO ---")
        assertContains(content, "export async function makeE2({ page })")
        assertContains(content, "export async function expectS1({ page })")
        assertContains(content, "export async function expectS2({ page })")
        assert.strictEqual((content.match(/function makeE1\b/g) ?? []).length, 1, "makeE1 must not be duplicated")
        assert.ok(
            content.indexOf(handWritten) < content.indexOf("// --- TODO ---"),
            "appended stubs must come after the existing content",
        )
    } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true })
    }
})

test("[TST-249] → [REQ-448]: writeFixtureFiles is a no-op when every stub is already defined", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "smtt-fixtures-write-test-"))
    try {
        const stateMachines: StateMachines = [{
            name: "m",
            states: [{ name: "s" }],
            transitions: [{ trigger: { type: "event", name: "e" }, result: { name: "s" } }],
        }]

        generateFixtures(stateMachines, tmpDir)
        const filePath = path.join(tmpDir, "m.fixtures.js")
        const firstRun = fs.readFileSync(filePath, "utf8")

        generateFixtures(stateMachines, tmpDir)
        const secondRun = fs.readFileSync(filePath, "utf8")

        assert.strictEqual(secondRun, firstRun, "re-running generate over an up-to-date file must not change it")
    } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true })
    }
})

test("[TST-250] → [REQ-450]: writeFixtureFiles appends only missing re-export lines to an existing fixtures/index.js", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "smtt-fixtures-write-test-"))
    try {
        const stateMachines: StateMachines = [{
            name: "m1",
            states: [{ name: "s1" }],
            transitions: [{ trigger: { type: "event", name: "e1" }, result: { name: "s1" } }],
        }, {
            name: "m2",
            states: [{ name: "s2" }],
            transitions: [{ trigger: { type: "event", name: "e2" }, result: { name: "s2" } }],
        }]

        const indexPath = path.join(tmpDir, "index.js")
        const handWritten = "export * from './m1.fixtures.js'\n"
        fs.writeFileSync(indexPath, handWritten, "utf8")

        generateFixtures(stateMachines, tmpDir)

        const content = fs.readFileSync(indexPath, "utf8")
        assertContains(content, handWritten)
        assertContains(content, "export * from './m2.fixtures.js'")
        assert.strictEqual(
            (content.match(/export \* from '\.\/m1\.fixtures\.js'/g) ?? []).length,
            1,
            "existing re-export line must not be duplicated",
        )
    } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true })
    }
})
