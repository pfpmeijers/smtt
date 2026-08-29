/**
 * Unit and integration tests for `analyze` with `--infer`, `--ast-file`,
 * mutual exclusivity checks, and report generation.
 */

import { test } from "node:test"
import * as assert from "node:assert/strict"
import * as fs from "fs"
import * as os from "os"
import * as path from "path"
import { fileURLToPath } from "url"
import { analyze } from "../analyze"
import { parse } from "../../parse"
import { infer } from "../../infer"

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const INFER_TEST_DIR = path.resolve(currentDir, "../../infer/tests/state-machines")

test("analyze: throws error when both astFile and infer options are provided", () => {
    assert.throws(
        () => {
            analyze(INFER_TEST_DIR, {
                astFile: "some/file.json",
                infer: true,
            })
        },
        {
            name: "Error",
            message: "Options --infer and --ast-file are mutually exclusive.",
        }
    )
})

test("analyze without infer: sets defined-only mode and includes warning note in report", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "smtt-analyze-test-"))
    const mdOut = path.join(tmpDir, "report-no-infer.md")

    try {
        const result = analyze(INFER_TEST_DIR, {
            outputFile: mdOut,
            infer: false,
        })

        assert.strictEqual(result.report.summary.impossibilityMode, "defined-only")
        assert.strictEqual(result.report.summary.inferredImpossibilities, 0)
        assert.ok(fs.existsSync(mdOut))

        const content = fs.readFileSync(mdOut, "utf8")
        assert.ok(content.includes("Defined impossibilities"))
        assert.ok(content.includes("Inferred impossibilities"))
        assert.ok(content.includes("Inferred impossibilities were **not** computed or loaded"))
    } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true })
    }
})

test("analyze with infer: computes inferred impossibilities and suppresses unhandled triggers", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "smtt-analyze-test-"))
    const mdOutNoInfer = path.join(tmpDir, "report-no-infer.md")
    const mdOutWithInfer = path.join(tmpDir, "report-infer.md")

    try {
        const resultNoInfer = analyze(INFER_TEST_DIR, {
            outputFile: mdOutNoInfer,
            infer: false,
        })

        const resultWithInfer = analyze(INFER_TEST_DIR, {
            outputFile: mdOutWithInfer,
            infer: true,
        })

        assert.strictEqual(resultWithInfer.report.summary.impossibilityMode, "inferred-new")
        assert.ok(resultWithInfer.report.summary.inferredImpossibilities > 0)

        // Inferred impossibilities should suppress unhandled trigger false positives
        assert.ok(
            resultWithInfer.report.summary.unhandledTriggers <=
                resultNoInfer.report.summary.unhandledTriggers
        )

        const content = fs.readFileSync(mdOutWithInfer, "utf8")
        assert.ok(content.includes("Inferred impossibility combinations were computed on-the-fly (`--infer`)"))
    } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true })
    }
})

test("analyze with ast-file: loads pre-inferred impossibilities from AST JSON", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "smtt-analyze-test-"))
    const astFile = path.join(tmpDir, "state-machines.json")
    const mdOut = path.join(tmpDir, "report-ast.md")

    try {
        // Parse and infer first to produce an enriched AST
        const stateMachines = parse(INFER_TEST_DIR)
        fs.writeFileSync(astFile, JSON.stringify({ stateMachines }, null, 2), "utf8")
        infer(astFile)

        const result = analyze(INFER_TEST_DIR, {
            astFile,
            outputFile: mdOut,
        })

        assert.strictEqual(result.report.summary.impossibilityMode, "inferred-ast")
        assert.ok(result.report.summary.inferredImpossibilities > 0)
        assert.strictEqual(result.report.astFile, astFile)

        const content = fs.readFileSync(mdOut, "utf8")
        assert.ok(content.includes("Impossibilities were loaded from the input AST JSON file"))
    } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true })
    }
})
