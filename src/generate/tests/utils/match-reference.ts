/**
 * Reference / result regression helpers for the Gherkin feature-file
 * generator test harness.
 *
 * These helpers combine on-disk result files (written by `createFeatures`
 * under `results/`) with checked-in snapshots in `references/` to perform
 * regression comparisons.
 */

import { strict as assert } from "node:assert"
import * as fs from "fs"
import * as path from "path"
import { type StateMachines } from "../../../parse"
import { annotate } from "./annotate"
import {
    callerTestFileName,
    currentTestName,
    numberedFileName,
    testIdFromName,
    testNumberFromId,
    testDir,
} from "./test"
import { normalizeNewlines } from "../../../tests/utils/assert";

/** Output directory for actual generator results (created on first write). */
export const RESULTS_DIR = path.resolve(testDir, "..", "results")

/** Directory containing the checked-in expected feature snapshots. */
const REFERENCES_DIR = path.resolve(testDir, "..", "references")

/**
 * Read a checked-in expected feature snapshot from `references/<file>`.
 *
 * @param file File name relative to `REFERENCES_DIR`.
 * @returns File content as a UTF-8 string.
 */
function readReferenceFile(file: string): string {
    return normalizeNewlines(fs.readFileSync(path.join(REFERENCES_DIR, file), "utf8"))
}

/**
 * Normalize, annotate, and persist a single result artifact for the current test.
 *
 * @param fileName File name relative to `RESULTS_DIR`.
 * @param stateMachines State-machine AST included in the annotation header.
 * @param content Raw feature or error content to write.
 * @returns Fully annotated text written to disk.
 */
function writeResultFile(
    fileName: string,
    stateMachines: StateMachines,
    content: string,
): string {
    const normalizedContent = normalizeNewlines(content)
    const testId = testIdFromName(currentTestName())
    const sourceTestFile = callerTestFileName()
    const header = annotate(stateMachines, sourceTestFile, testId)
    const annotated = header === ""
        ? normalizedContent
        : `${header}\n\n${normalizedContent}`
    fs.mkdirSync(RESULTS_DIR, { recursive: true })
    fs.writeFileSync(path.join(RESULTS_DIR, fileName), annotated, "utf8")
    return annotated
}

/**
 * Build an assertion message for a failed content-vs-references comparison.
 *
 * @param summary Human-readable summary of the mismatch (e.g., "Generated feature
 *     does not match references").
 * @param fileName Name of the file being compared.
 * @param actual The actual generated content.
 * @param expected The expected references content.
 * @returns A formatted assertion message with `ACTUAL` and `EXPECTED` sections.
 */
function buildMismatchMessage(
    summary: string,
    fileName: string,
    actual: string,
    expected: string,
): string {
    return `${summary} for \`${fileName}\`.\n--- ACTUAL ---\n${actual}\n--- EXPECTED ---\n${expected}`
}

/**
 * Convert an arbitrary thrown value into an `Error` to normalize error handling.
 *
 * Handles cases where code throws non-`Error` values (e.g., strings, objects).
 * This ensures consistent error-message extraction via `.message` property.
 *
 * @param thrownValue Any value that was caught from a `throw` statement.
 * @returns An `Error` instance. If `thrownValue` is already an `Error`, returns
 *     it as-is. If a string, wraps it in `new Error()`. Otherwise, creates an
 *     `Error` with a descriptive message.
 */
function toError(thrownValue: unknown): Error {
    if (thrownValue instanceof Error) {
        return thrownValue
    }
    if (typeof thrownValue === "string") {
        return new Error(thrownValue)
    }
    return new Error(`Non-error value was thrown: \`${String(thrownValue)}\``)
}

/**
 * Run `action`, capture a thrown error, and return `undefined` if no error was
 * thrown.
 *
 * @param action A function that may throw an error.
 * @returns An `Error` instance if `action` threw, or `undefined` if it
 *     completed without throwing.
 */
function captureError(action: () => unknown): Error | undefined {
    try {
        action()
    } catch (thrownValue) {
        return toError(thrownValue)
    }
    return undefined
}

/**
 * Persist the provided feature content as the current test result file and
 * assert that it matches the checked-in snapshot in `references/`.
 *
 * @param stateMachines State-machine AST included in the annotation header.
 * @param featureContent Rendered feature content for the state machine under
 *     test.
 * @throws Assertion error if the generated content does not match the references
 *     snapshot.
 */
export function assertMatchesReference(stateMachines: StateMachines, featureContent: string): void {
    const testNumber = testNumberFromId(testIdFromName(currentTestName()))
    const file = `${testNumber}.feature`
    const actual = writeResultFile(file, stateMachines, featureContent)
    const expected = readReferenceFile(file)
    assert.strictEqual(
        actual,
        expected,
        buildMismatchMessage("Generated feature does not match references", file, actual, expected)
    )
}

/**
 * Run `action` and assert that it throws an error whose message matches the
 * provided exact string. The thrown error is captured, persisted, and compared
 * to a checked-in references snapshot.
 *
 * The result file is named `<testNumber>.feature` (e.g. `022.feature`),
 * matching the same naming convention used for non-throwing test cases. The
 * test number is derived from the current test context, so callers do not have
 * to pass any id in. The captured error is annotated with the same
 * `# Results from:` / `# State machines:` / `# Covers requirements:` header
 * block used for non-throwing snapshots, so error-path references carry the
 * same context.
 *
 * @param stateMachines State-machine AST included in the annotation header.
 * @param action A function that is expected to throw an error.
 * @param errorMessage The exact error message expected when `action` throws.
 * @throws Assertion error if `action` does not throw, or if the error message
 *     does not match the provided `errorMessage` exactly.
 */
export function assertThrowMatchesReference(
    stateMachines: StateMachines,
    action: () => void,
    errorMessage: string,
): void {
    const file = numberedFileName()
    const captured = captureError(action)
    const reported = captured?.message ?? "<no error thrown>"
    const content = `# Throws: ${reported}\n`
    const annotated = writeResultFile(file, stateMachines, content)

    const expected = readReferenceFile(file)
    assert.strictEqual(
        annotated,
        expected,
        buildMismatchMessage("Error output does not match references", file, annotated, expected)
    )
    if (captured === undefined) {
        throw new Error(`Expected function to throw for \`${file}\`, but it completed without error.`)
    }
    assert.strictEqual(
        captured.message,
        errorMessage,
        `Error message \`${captured.message}\` did not match expected \`${errorMessage}\`.`
    )
}
