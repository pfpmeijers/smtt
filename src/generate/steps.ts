import * as fs from "fs"
import * as path from "path"
import type { Feature, Step } from "./features"

/**
 * Sort steps by rendered pattern.
 *
 * @param steps Steps to sort.
 * @returns Steps sorted by pattern.
 */
function sortedByPattern(steps: Step[]): Step[] {
    return [...steps].sort((left, right) => left.pattern.localeCompare(right.pattern))
}

/**
 * Parse the numeric portion of a transition id.
 *
 * @param transitionId Transition id to parse.
 * @returns Numeric id, or `null` when the id is not numbered.
 */
function parseTransitionIdNumber(transitionId: string): number | null {
    const match = transitionId.match(/^#(\d+)$/)
    if (match === null) return null
    return Number(match[1])
}

/**
 * Compare transition ids, preferring numeric order when possible.
 *
 * @param leftTransitionId Left transition id.
 * @param rightTransitionId Right transition id.
 * @returns Comparison result for sorting.
 */
function compareTransitionIds(leftTransitionId: string, rightTransitionId: string): number {
    const leftNumericId = parseTransitionIdNumber(leftTransitionId)
    const rightNumericId = parseTransitionIdNumber(rightTransitionId)

    if (leftNumericId !== null && rightNumericId !== null) {
        return leftNumericId - rightNumericId
    }
    if (leftNumericId !== null) return -1
    if (rightNumericId !== null) return 1
    return leftTransitionId.localeCompare(rightTransitionId)
}

/**
 * Remove duplicate transition ids and sort them deterministically.
 *
 * @param transitionIds Transition ids to normalize.
 * @returns Deduplicated and sorted ids.
 */
function uniqueSortedTransitionIds(transitionIds: string[]): string[] {
    const uniqueTransitionIds = [...new Set(transitionIds)]
    return uniqueTransitionIds.sort(compareTransitionIds)
}

/**
 * Render one step.
 *
 * @param step Step to render.
 * @returns The rendered step text.
 */
function buildStep(step: Step): string {
    const quotedPattern = step.pattern.replace(/'/g, "\\'")
    const paramsSignature = step.params.length > 0 ? `, ${step.params.join(", ")}` : ""
    const fixtureCall = step.params.length > 0
        ? `await fixtures.${step.fixtureName}({ page }, ${step.params.join(", ")})`
        : `await fixtures.${step.fixtureName}({ page })`
    const transitionIds = uniqueSortedTransitionIds(step.transitionIds)
    const comment = `// ${transitionIds.join(", ")}`
    const stepText = `${step.keyword}('${quotedPattern}', async ({ page }${paramsSignature}) => {\n` +
        `  ${fixtureCall}\n` +
        `})\n`
    return `${comment}\n${stepText}`
}

/**
 * Build a `Given`, `When`, or `Then` section.
 *
 * @param steps Steps for the section.
 * @param sectionLabel Human-readable section label.
 * @returns Section text.
 */
function buildSection(steps: Step[], sectionLabel: string): string {
    let section = `\n// --- ${sectionLabel} ---\n`
    for (const step of steps) {
        section += `\n${buildStep(step)}`
    }
    return section
}

/**
 * Build the full content for one `.steps.js` file.
 *
 * @param steps Steps for one state machine.
 * @returns Step file content.
 */
function buildStepFileContent(steps: Step[]): string {
    const givens = sortedByPattern(steps.filter((step) => step.keyword === "Given"))
    const whens = sortedByPattern(steps.filter((step) => step.keyword === "When"))
    const thens = sortedByPattern(steps.filter((step) => step.keyword === "Then"))

    const imports = "import { Given, When, Then } from '../utils'\n" +
        "import * as fixtures from '../fixtures/index.js'\n"
    const content = imports + buildSection(givens, "Given") + buildSection(whens, "When") + buildSection(thens, "Then")
    return `${content}\n`
}

/**
 * Lowercase and hyphenate a state machine name.
 *
 * @param name State machine name.
 * @returns Slugified file stem.
 */
function slugify(name: string): string {
    return name.toLowerCase().replace(/\s+/g, "-")
}

/**
 * Render one `.steps.js` file per state machine.
 *
 * @param features Normalized feature data with generated steps.
 * @returns Step file content keyed by file name.
 */
export function renderStepFiles(features: Feature[]): Map<string, string> {
    const files = new Map<string, string>()
    for (const feature of features) {
        files.set(
            `${slugify(feature.stateMachine.name)}.steps.js`,
            buildStepFileContent(feature.steps),
        )
    }
    return files
}

/**
 * Write one `.steps.js` file per state machine into `stepsDir`.
 *
 * @param features Normalized feature data with generated steps.
 * @param stepsDir Output directory for step files.
 */
export function writeStepFiles(features: Feature[], stepsDir: string): void {
    fs.mkdirSync(stepsDir, { recursive: true })
    for (const [fileName, content] of renderStepFiles(features)) {
        const filePath = path.join(stepsDir, fileName)
        fs.writeFileSync(filePath, content, "utf8")
        console.info(`Generated: \`${filePath}\``)
    }
}

