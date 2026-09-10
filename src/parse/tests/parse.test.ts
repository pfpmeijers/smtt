/**
 * Output regression tests for parser.
 * Runs on every `*.state-machine.md` file in a given directory, and compares combined result against a stored
 * reference snapshot.
 */

import { describe, it } from "node:test"
import * as assert from "node:assert/strict"
import * as fs from "fs"
import * as path from "path"
import * as YAML from "yaml"
import { fileURLToPath } from "url"

import { parse } from "../parse"

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const testStateMachinesDir = path.resolve(currentDir, "state-machines")
const referencesDir = path.resolve(currentDir, "references")
const resultsDir = path.resolve(currentDir, "results")

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

function writeResult(file: string, source: string): void {
    fs.writeFileSync(path.join(resultsDir, file), source, "utf8")
}

function loadResult(file: string): string {
    return fs.readFileSync(path.join(resultsDir, file), "utf8")
}

function loadReference(file: string): string {
    return fs.readFileSync(path.join(referencesDir, file), "utf8")
}

function loadParserResult(file: string): unknown {
    return YAML.parse(loadResult(file))
}

function loadParserReference(file: string): unknown {
    return YAML.parse(loadReference(file))
}

function writeParserResult(file: string, parserResult: unknown): void {
    fs.mkdirSync(resultsDir, { recursive: true })
    writeResult(file, YAML.stringify(stripNulls(parserResult)))
}

// --- Tests ---

describe("parser output regression", () => {
    it("[TST-157]: matches references snapshot for local test state-machines directory", () => {
        writeParserResult("test.state-machines.yaml", parse(testStateMachinesDir))
        assert.deepStrictEqual(
            loadParserResult("test.state-machines.yaml"),
            loadParserReference("test.state-machines.yaml"),
        )
    })
})

