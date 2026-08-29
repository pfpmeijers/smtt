/**
 * Output regression tests for parser.
 * Each test compiles `sm.ohm`, runs it on every
 * `*.state-machine.md` file in a given directory, collects the results
 * into `{ stateMachines: [...] }`, and compares against a stored references snapshot.
 */

import { describe, it } from "node:test"
import * as assert from "node:assert/strict"
import * as fs from "fs"
import * as path from "path"
import * as YAML from "yaml"
import { fileURLToPath } from "url"

import { parse } from "../parse"
import { normalizeSourcePaths } from "../../tests/utils/assert"

const currentDir = path.dirname(fileURLToPath(import.meta.url))
// const APP_STATE_MACHINES_DIR = path.resolve(currentDir, "../../../../state-machines")
const TEST_STATE_MACHINES_DIR = path.resolve(currentDir, "state-machines")
const REFERENCES_DIR = path.resolve(currentDir, "references")
const RESULTS_DIR = path.resolve(currentDir, "results")

function writeResult(file: string, source: string): void {
    fs.writeFileSync(path.join(RESULTS_DIR, file), source, "utf8")
}

function loadResult(file: string): string {
    return fs.readFileSync(path.join(RESULTS_DIR, file), "utf8")
}

function loadReference(file: string): string {
    return fs.readFileSync(path.join(REFERENCES_DIR, file), "utf8")
}

function loadParserResult(file: string): unknown {
    return YAML.parse(loadResult(file))
}

function loadParserReference(file: string): unknown {
    return YAML.parse(loadReference(file))
}

function writeParserResult(file: string, parserResult: unknown): void {
    fs.mkdirSync(RESULTS_DIR, { recursive: true })
    writeResult(file, YAML.stringify(stripNulls(parserResult)))
}

function stripNulls<T>(value: T): T {
    if (Array.isArray(value)) {
        return value
            .map((item) => stripNulls(item))
            .filter((item) => item !== null) as T
    }

    if (value && typeof value === "object") {
        const cleanedEntries = Object.entries(value as Record<string, unknown>)
            .filter(([, v]) => v !== null)
            .map(([k, v]) => [k, stripNulls(v)])

        return Object.fromEntries(cleanedEntries) as T
    }

    return value
}

// --- Tests ---

describe("parser output regression", () => {
    it("matches references snapshot for local test state-machines directory", () => {
        writeParserResult("test.state-machines.yaml", parse(TEST_STATE_MACHINES_DIR))
        assert.deepStrictEqual(
            normalizeSourcePaths(loadParserResult("test.state-machines.yaml")),
            normalizeSourcePaths(loadParserReference("test.state-machines.yaml")),
        )
    })

    // it("matches references snapshot for default state-machines directory", () => {
    //     writeParserResult("state-machines.yaml", parse(APP_STATE_MACHINES_DIR))
    //     assert.deepStrictEqual(loadParserResult("state-machines.yaml"), loadParserReference("state-machines.yaml"))
    // })
})

