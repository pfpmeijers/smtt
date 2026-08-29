/**
 * Output regression tests for the inferrer.
 * Each test parses all `*.state-machine.md` files in a given directory, runs
 * closed-world impossibility inference, and compares the enriched JSON against
 * a stored references snapshot.
 */

import { test } from "node:test"
import * as assert from "node:assert/strict"
import * as fs from "fs"
import * as os from "os"
import * as path from "path"
import { fileURLToPath } from "url"
import { parse } from "../../parse"
import { normalizeSourcePaths } from "../../tests/utils/assert"
import { infer } from "../infer"

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const TEST_STATE_MACHINES_DIR = path.resolve(currentDir, "state-machines")
const REFERENCES_DIR = path.resolve(currentDir, "references")
const RESULTS_DIR = path.resolve(currentDir, "results")

// --- Helpers ---

/**
 * Parses all state machines in `dir`, runs inference, and writes the enriched
 * JSON to `RESULTS_DIR/<name>`. Returns the written result as a parsed object.
 */
function runPipeline(dir: string, outputName: string): unknown {
    const stateMachines = parse(dir)
    const parsed = { stateMachines }
    const tmpFile = path.join(os.tmpdir(), `smtt-infer-test-${Date.now()}.json`)
    fs.writeFileSync(tmpFile, JSON.stringify(parsed, null, 2), "utf8")
    infer(tmpFile)
    const enriched = JSON.parse(fs.readFileSync(tmpFile, "utf8"))
    fs.rmSync(tmpFile)

    fs.mkdirSync(RESULTS_DIR, { recursive: true })
    fs.writeFileSync(path.join(RESULTS_DIR, outputName), JSON.stringify(enriched, null, 2), "utf8")
    return enriched
}

function loadReference(name: string): unknown {
    return JSON.parse(fs.readFileSync(path.join(REFERENCES_DIR, name), "utf8"))
}

// --- Tests ---

test("inferrer output matches references snapshot for local test state-machines directory", () => {
    const result = runPipeline(TEST_STATE_MACHINES_DIR, "test.state-machines.json")
    assert.deepStrictEqual(normalizeSourcePaths(result), normalizeSourcePaths(loadReference("test.state-machines.json")))
})
