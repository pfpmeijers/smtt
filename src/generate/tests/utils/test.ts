import nodeTest from "node:test"
import path from "path"
import { fileURLToPath } from "url"

/**
 * Module-level holder for the name of the test that is currently running.
 * The harness's `test()` wrapper sets this before invoking the test callback,
 * and `currentTestName()` reads it. This avoids relying on `node:test`'s
 * `TestContext`, which is not always visible from nested helper functions.
 */
let _currentTestName: string | null = null

/**
 * Set the module-level current test name holder.
 *
 * @param name Current test name, or `null` to clear the holder.
 */
export function setCurrentTestName(name: string | null): void {
    _currentTestName = name
}

/**
 * Return the name of the currently running `node:test` test, or `null` when
 * called outside any test context.
 *
 * @returns Current test name, or `null` if no test is active.
 */
export function currentTestName(): string | null {
    return _currentTestName
}

/** Absolute path of the directory holding this module (the harness `utils/`). */
export const testDir = path.dirname(fileURLToPath(import.meta.url))
/** Absolute path of this module file, used to skip harness frames in the stack. */
const harnessAbs = path.resolve(testDir, path.basename(fileURLToPath(import.meta.url)))

/**
 * Walk the V8 stack trace to find the first frame that lives outside this
 * harness's `utils/` directory and return the caller file basename.
 *
 * @returns Caller file basename, or an empty string if no caller frame can be
 *     identified.
 */
export function callerTestFileName(): string {
    const stackHolder: { stack?: string } = {}
    Error.captureStackTrace(stackHolder, callerTestFileName)
    const stack = stackHolder.stack ?? ""
    const frameRe = /\(?(.+?):\d+:\d+\)?/g
    let match: RegExpExecArray | null
    while ((match = frameRe.exec(stack)) !== null) {
        const filePath = match[1]
        if (filePath === harnessAbs) continue
        if (/(^|[\\/])utils[\\/].*\.ts$/.test(filePath)) continue
        return path.basename(filePath)
    }
    return ""
}

/**
 * Lowercase and replace whitespace with hyphens, mirroring `features.ts`'s
 * private `slugify`.
 */
export function slugifyName(name: string): string {
    return name.toLowerCase().replace(/\s+/g, "-")
}

/**
 * Build the `<testNumber>.feature` result-file name used by the snapshot
 * helpers.
 *
 * @returns Result-file name derived from the current test context.
 */
export function numberedFileName(): string {
    const testNumber = testNumberFromId(testIdFromName(currentTestName()))
    return `${testNumber}.feature`
}

/**
 * Extract the `[TST-NNN]` test id from a test name.
 *
 * @param name Test name that may contain a `TST-NNN` token.
 * @returns Extracted test id.
 * @throws Error if `name` is `null` or does not contain a `TST-NNN` token.
 */
export function testIdFromName(name: string | null): string {
    if (name === null) {
        throw new Error("testIdFromName called outside a running test context")
    }
    const match = name.match(/\[(TST-\d+)]/)
    if (match === null) {
        throw new Error(`Test name "${name}" does not contain a [TST-NNN] id`)
    }
    return match[1]
}


/**
 * Extract the numeric portion of a `TST-NNN` test id.
 *
 * @param id Test id in `TST-NNN` form.
 * @returns Zero-padded numeric portion suitable for file names.
 * @throws Error if `id` does not match `TST-NNN`.
 */
export function testNumberFromId(id: string): string {
    const match = id.match(/^TST-(\d+)$/)
    if (match === null) {
        throw new Error(`Invalid test id "${id}" — expected "TST-NNN"`)
    }
    return match[1].padStart(3, "0")
}

/**
 * Extract the `REQ-NNN` ids from a test name.
 *
 * @param name Test name that may contain a requirement block.
 * @returns Requirement ids extracted from the test name, or an empty array.
 */
export function requirementIdsFromName(name: string | null): string[] {
    if (name === null) return []
    const blockMatch = name.match(/\[TST-\d+]\s*→\s*\[REQ-([\d/]+)]/)
    if (blockMatch === null) return []
    return blockMatch[1].split("/").map((id) => `REQ-${id}`)
}

/**
 * Extract the human-readable title portion of a test name.
 *
 * @param name Test name that may contain an id and requirement block.
 * @returns Title text, or `undefined` if no title text is present.
 */
export function testTitleFromName(name: string | null): string | undefined {
    if (name === null) return undefined
    const match = name.match(/^(?:\[TST-\d+]\s*(?:→\s*\[REQ-[\d/]+]\s*)?)?:?\s*(.*)$/)
    if (match !== null && match[1] !== "") {
        return match[1].trim()
    }
    return undefined
}

/**
 * Wrap `node:test`'s `test()` so the harness can read the running test's name.
 *
 * @param name Test name.
 * @param fn Test callback to execute.
 */
export function test(name: string, fn: () => void | Promise<void>): void {
    void nodeTest(name, async () => {
        setCurrentTestName(name)
        try {
            await fn()
        } finally {
            setCurrentTestName(null)
        }
    })
}
