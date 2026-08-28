/**
 * Annotation helpers for the Gherkin feature-file generator test harness.
 *
 * These helpers wrap dumped feature-file content with the `# Covers
 * requirements:` block that corresponds to the running test scenario, so
 * the result file carries a header that points reviewers at the test that
 * produced it and the requirements it covers.
 *
 * The harness's `createFeatures()` flow uses {@link annotate}
 * to wrap every state machine's dumped feature file before it lands under
 * `results/`, and the error-path helpers in `match-references.ts` use it to
 * wrap captured `Throws:` output. The requirement ids are read directly from
 * the running test's title, so no source feature file needs to be parsed.
 */

import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import YAML from "yaml"
import { StateMachines } from "../../../parse"
import { currentTestName, requirementIdsFromName, testTitleFromName } from "./test"

/** Maximum width (in characters) of a wrapped `# - [REQ-NNN] ...` comment line. */
const REQUIREMENT_COMMENT_WRAP_WIDTH = 100

/**
 * Absolute path to the requirements spec markdown that documents every
 * `REQ-NNN` id used across the generator's test titles. Resolved relative to
 * this module so it keeps working regardless of the process's cwd.
 */
const requirementsSpecPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../../../docs/smtt.generate.features.md",
)

/** Lazily-populated, module-level cache of `REQ-NNN` id -> requirement text. */
let requirementTextsCache: Map<string, string> | null = null

/**
 * Parse the requirements spec markdown into a lookup of requirement id to
 * requirement text.
 *
 * Continuation lines are folded into a single line per requirement so wrapped
 * spec bullets can be rendered consistently in generated comments.
 *
 * @param markdown Requirements spec markdown text.
 * @returns A lookup map from `REQ-NNN` id to requirement text.
 */
function parseRequirementTexts(markdown: string): Map<string, string> {
    const requirementStartRe = /^\s*-\s*\[(REQ-\d+)]\s*(.*)$/
    const result = new Map<string, string>()
    let currentId: string | null = null
    let currentParts: string[] = []
    const flush = () => {
        if (currentId !== null) {
            result.set(currentId, currentParts.join(" ").trim())
        }
        currentId = null
        currentParts = []
    }
    for (const line of markdown.split(/\r?\n/)) {
        const requirementMatch = line.match(requirementStartRe)
        if (requirementMatch !== null) {
            flush()
            currentId = requirementMatch[1]
            currentParts = [requirementMatch[2].trim()]
            continue
        }
        if (currentId === null) continue
        const trimmed = line.trim()
        if (trimmed === "" || /^[-#|]/.test(trimmed) || trimmed.startsWith("```")) {
            flush()
            continue
        }
        currentParts.push(trimmed)
    }
    flush()
    return result
}

/** Load (and cache) the `REQ-NNN` -> requirement text lookup from the spec markdown. */
function loadRequirementTexts(): Map<string, string> {
    if (requirementTextsCache === null) {
        requirementTextsCache = parseRequirementTexts(
            fs.readFileSync(requirementsSpecPath, "utf-8"),
        )
    }
    return requirementTextsCache
}

/**
 * Wrap comment text into lines that fit within the configured width.
 *
 * @param text Text to wrap.
 * @param initialPrefix Prefix used for the first line.
 * @param continuationPrefix Prefix used for all wrapped continuation lines.
 * @param maxWidth Maximum allowed line length.
 * @returns Wrapped comment lines.
 */
function wrapCommentText(
    text: string,
    initialPrefix: string,
    continuationPrefix: string,
    maxWidth: number,
): string[] {
    const words = text.split(/\s+/).filter((word) => word.length > 0)
    const lines: string[] = []
    let current = initialPrefix
    for (const word of words) {
        const atLineStart = current === initialPrefix || current === continuationPrefix
        const candidate = atLineStart ? `${current}${word}` : `${current} ${word}`
        if (candidate.length > maxWidth && !atLineStart) {
            lines.push(current)
            current = `${continuationPrefix}${word}`
        } else {
            current = candidate
        }
    }
    lines.push(current)
    return lines
}

/**
 * Format the state-machine AST as a YAML comment block.
 *
 * @param stateMachines State machines to serialize into comments.
 * @returns YAML text with every line prefixed by `#`.
 */
function formatAstAsCommentBlock(stateMachines: StateMachines): string {
    const yaml = YAML.stringify(stateMachines, { lineWidth: 0 }).replace(/\n+$/, "")
    return yaml
        .split("\n")
        .map((line) => `#${line.length > 0 ? "  " : ""}${line}`)
        .join("\n")
}

/**
 * Build the `# Results from:` header line when source metadata is available.
 *
 * @param sourceTestFile Source test file name.
 * @param testId Optional current test id.
 * @param testTitle Optional current test title.
 * @returns A formatted results header line, or `undefined` when no source test
 *     file is available.
 */
function buildResultsFromHeaderLine(
    sourceTestFile: string | undefined,
    testId: string | undefined,
    testTitle: string | undefined,
): string | undefined {
    if (sourceTestFile === undefined || sourceTestFile === "") {
        return undefined
    }
    const resolvedTestTitle = testTitle ?? ""
    const titleSuffix = resolvedTestTitle !== "" ? `: ${resolvedTestTitle}` : ""
    const idSuffix = testId !== undefined && testId !== ""
        ? `, ${testId}${titleSuffix}`
        : titleSuffix !== ""
            ? `, ${titleSuffix}`
            : ""
    return `# Results from: ${sourceTestFile}${idSuffix}`
}

/**
 * Build the annotation header block for the current test scenario.
 *
 * Each `[REQ-NNN]` entry is followed by its requirement text, looked up from
 * `docs/smtt.generate.features.md` and word-wrapped across `#`-prefixed
 * continuation lines. Ids that cannot be found in the spec cause an error so
 * unknown or removed requirement references fail during test execution.
 *
 * When `sourceTestFile` is provided, a `# Results from: <file>, <testId>: <testTitle>`
 * line is added above the test block so the dumped feature carries an explicit
 * pointer back to the test that produced it.
 *
 * The state-machine AST is included under a `# State machines:` header with
 * every line prefixed by `#`, giving reviewers a structured view of the input
 * that produced the dumped feature.
 *
 * @param stateMachines State machines to include in the annotation header.
 * @param sourceTestFile Source test file name used in the results header.
 * @param testId Optional current test id used in the results header.
 * @param testTitle Optional explicit test title used in the results header.
 * @returns Annotation header block, or an empty string when no metadata is
 *     available.
 */
export function annotate(
    stateMachines: StateMachines,
    sourceTestFile?: string,
    testId?: string,
    testTitle?: string,
): string {
    const headerParts: string[] = []
    const resolvedTestTitle = testTitle ?? testTitleFromName(currentTestName())
    const resultsFromHeaderLine = buildResultsFromHeaderLine(sourceTestFile, testId, resolvedTestTitle)
    if (resultsFromHeaderLine !== undefined) {
        headerParts.push(resultsFromHeaderLine)
    }
    const stateMachinesBlock = formatAstAsCommentBlock(stateMachines)
    headerParts.push(`# State machines:`)
    headerParts.push(stateMachinesBlock)
    const requirementIds = requirementIdsFromName(currentTestName())
    if (requirementIds.length > 0) {
        headerParts.push(`# Covers requirements:`)
        const requirementTexts = loadRequirementTexts()
        for (const reqId of requirementIds) {
            const text = requirementTexts.get(reqId)
            if (text === undefined) {
                throw new Error(
                    `Unknown requirement id "${reqId}" referenced by test ` +
                    `"${currentTestName() ?? "<unknown>"}". ` +
                    `Add it to docs/smtt.generate.features.md or fix the test title.`,
                )
            }
            headerParts.push(
                ...wrapCommentText(text, `# - [${reqId}] `, "#   ", REQUIREMENT_COMMENT_WRAP_WIDTH),
            )
        }
    }
    return headerParts.join("\n")
}
