import fs from "fs";
import path from "path";
import { strict as assert } from "node:assert";

type ContentNormalizer = (relativeFile: string, content: Buffer) => Buffer

function collectFiles(rootDir: string, currentDir = rootDir, files: string[] = []): string[] {
    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
        const fullPath = path.join(currentDir, entry.name)
        if (entry.isDirectory()) {
            collectFiles(rootDir, fullPath, files)
            continue
        }
        files.push(path.relative(rootDir, fullPath))
    }
    return files.sort()
}

/**
 * Recursively normalize values of `source` properties so snapshots remain stable
 * across different absolute checkout paths.
 *
 * @param value Arbitrary JSON-like value.
 * @returns A structurally equal value with normalized `source` strings.
 */
export function normalizeSourcePaths<T>(value: T): T {
    if (Array.isArray(value)) {
        return value.map(item => normalizeSourcePaths(item)) as T
    }

    if (value && typeof value === "object") {
        const entries = Object.entries(value as Record<string, unknown>).map(([key, entry]) => {
            if (key === "source" && typeof entry === "string") {
                const normalized = entry
                    .replace(/^[A-Za-z]:[\\/].*?[\\/]src[\\/]/, "src/")
                    .replace(/\\/g, "/")
                return [key, normalized]
            }

            return [key, normalizeSourcePaths(entry)]
        })

        return Object.fromEntries(entries) as T
    }

    return value
}

/**
 * Normalize serialized JSON by rewriting absolute `source` paths into stable,
 * repository-relative values.
 *
 * @param content File content that should contain valid JSON.
 * @returns Normalized JSON string as UTF-8 `Buffer`.
 */
export function normalizeSourcePathsInJson(content: Buffer): Buffer {
    const parsed = JSON.parse(content.toString("utf8"))
    const normalized = normalizeSourcePaths(parsed)
    return Buffer.from(`${JSON.stringify(normalized, null, 2)}\n`, "utf8")
}

/**
 * Assert that two directory trees have identical files and file content.
 *
 * @param actualDir Directory containing generated output.
 * @param expectedDir Directory containing reference output.
 * @param normalizeContent Optional normalizer used before byte comparison.
 */
export function assertDirectoriesEqual(
    actualDir: string,
    expectedDir: string,
    normalizeContent?: ContentNormalizer,
): void {
    const actualFiles = collectFiles(actualDir)
    const expectedFiles = collectFiles(expectedDir)

    assert.deepStrictEqual(
        actualFiles,
        expectedFiles,
        `Directory trees differ between \`${actualDir}\` and \`${expectedDir}\``,
    )

    for (const relativeFile of actualFiles) {
        const rawActualContent = fs.readFileSync(path.join(actualDir, relativeFile))
        const rawExpectedContent = fs.readFileSync(path.join(expectedDir, relativeFile))
        const actualContent = normalizeContent
            ? normalizeContent(relativeFile, rawActualContent)
            : rawActualContent
        const expectedContent = normalizeContent
            ? normalizeContent(relativeFile, rawExpectedContent)
            : rawExpectedContent
        assert.ok(
            actualContent.equals(expectedContent),
            `File content differs for \`${relativeFile}\` between \`${actualDir}\` and \`${expectedDir}\``,
        )
    }
}

/** Normalize CRLF line endings to LF so string comparisons are platform-independent. */
export function normalizeNewlines(text: string): string {
    return text.replace(/\r\n/g, "\n")
}

/**
 * Assert that `content` contains `substring` after normalizing line endings.
 *
 * @param content Full text that is expected to contain the substring.
 * @param substring Text that must appear in `content`.
 */
export function assertContains(content: string, substring: string): void {
    const normalizedContent = normalizeNewlines(content)
    const normalizedSubstring = normalizeNewlines(substring)
    assert.ok(
        normalizedContent.includes(normalizedSubstring),
        `Expected content to contain substring: ${JSON.stringify(normalizedSubstring)}\n` +
        `Actual content:\n${normalizedContent}`
    )
}

/**
 * Assert that `content` does not contain `substring` after normalizing line endings.
 *
 * @param content Full text that is expected to exclude the substring.
 * @param substring Text that must not appear in `content`.
 */
export function assertNotContains(content: string, substring: string): void {
    const normalizedContent = normalizeNewlines(content)
    const normalizedSubstring = normalizeNewlines(substring)
    assert.ok(
        !normalizedContent.includes(normalizedSubstring),
        `Expected content NOT to contain substring: ${JSON.stringify(normalizedSubstring)}\n` +
        `Actual content:\n${normalizedContent}`
    )
}

/**
 * Assert that the line containing `substring` starts with exactly
 * `expectedIndent` spaces.
 *
 * @param content Full text to inspect.
 * @param substring Text used to locate the target line.
 * @param expectedIndent Expected number of leading spaces.
 */
export function assertIndented(content: string, substring: string, expectedIndent: number): void {
    const lines = normalizeNewlines(content).split("\n")
    const line = lines.find((candidate) => candidate.includes(substring))
    assert.ok(line !== undefined, `Could not find line containing: ${substring}`)
    const prefix = " ".repeat(expectedIndent)
    assert.ok(
        line.startsWith(prefix) && !line.startsWith(prefix + " "),
        `Expected line to be indented by exactly ${expectedIndent} spaces, but was: ` +
        `${JSON.stringify(line)}`
    )
}

/**
 * Assert that exactly `expectedCount` blank lines appear between two matching lines.
 *
 * @param content Full text to inspect.
 * @param firstSubstring Text used to locate the first line.
 * @param secondSubstring Text used to locate the second line.
 * @param expectedCount Expected number of blank lines between the matching lines.
 */
export function assertBlankLinesBetween(
    content: string,
    firstSubstring: string,
    secondSubstring: string,
    expectedCount: number
): void {
    const normalized = normalizeNewlines(content)
    const lines = normalized.split("\n")

    let firstIndex = -1
    let secondIndex = -1

    if (firstSubstring === secondSubstring) {
        firstIndex = lines.findIndex((line) => line.includes(firstSubstring))
        if (firstIndex !== -1) {
            secondIndex = lines.findIndex((line, index) => index > firstIndex && line.includes(secondSubstring))
        }
    } else {
        firstIndex = lines.findIndex((line) => line.includes(firstSubstring))
        secondIndex = lines.findIndex((line) => line.includes(secondSubstring))
    }

    assert.ok(firstIndex !== -1, `Could not find first line containing: ${firstSubstring}`)
    assert.ok(secondIndex !== -1, `Could not find second line containing: ${secondSubstring}`)
    assert.ok(firstIndex < secondIndex, `First line must appear before second line`)

    let blankCount = 0
    for (let index = firstIndex + 1; index < secondIndex; index++) {
        if (lines[index].trim() === "") {
            blankCount++
        }
    }

    assert.strictEqual(
        blankCount,
        expectedCount,
        `Expected exactly ${expectedCount} blank line(s) between ` +
        `"${firstSubstring}" and "${secondSubstring}", but found ${blankCount}`
    )
}

/**
 * Assert that no blank line appears between two matching lines.
 *
 * @param content Full text to inspect.
 * @param firstLineSubstring Text used to locate the first line.
 * @param secondLineSubstring Text used to locate the second line.
 */
export function assertNoBlankLineBetween(content: string, firstLineSubstring: string, secondLineSubstring: string): void {
    const normalized = normalizeNewlines(content)
    const lines = normalized.split("\n")
    const firstIndex = lines.findIndex((line) => line.includes(firstLineSubstring))
    const secondIndex = lines.findIndex((line) => line.includes(secondLineSubstring))
    assert.ok(firstIndex !== -1, `Could not find line containing: ${firstLineSubstring}`)
    assert.ok(secondIndex !== -1, `Could not find line containing: ${secondLineSubstring}`)
    assert.ok(
        firstIndex < secondIndex,
        `First line "${firstLineSubstring}" must appear before second line ` +
        `"${secondLineSubstring}"`,
    )
    for (let index = firstIndex + 1; index < secondIndex; index++) {
        assert.ok(
            lines[index].trim() !== "",
            `Expected no blank line between "${firstLineSubstring}" and ` +
            `"${secondLineSubstring}", but found one at line ${index + 1}`
        )
    }
}