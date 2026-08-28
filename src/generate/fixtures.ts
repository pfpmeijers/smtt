import fs from "fs"
import path from "path"
import type { Feature, Step } from "./features"

/**
 * Sort steps by fixture function name.
 *
 * @param steps Steps to sort.
 * @returns Steps sorted by fixture function name.
 */
function sortedByName(steps: Step[]): Step[] {
    return [...steps].sort((left, right) => left.fixtureName.localeCompare(right.fixtureName))
}

/**
 * Deduplicate steps by fixture function name, keeping the widest parameter list (REQ-309/310).
 *
 * @param steps Steps to deduplicate.
 * @returns One step per unique fixture function name.
 */
function deduplicateByName(steps: Step[]): Step[] {
    const map = new Map<string, Step>()
    for (const step of steps) {
        const existing = map.get(step.fixtureName)
        if (existing === undefined || step.params.length > existing.params.length) {
            map.set(step.fixtureName, step)
        }
    }
    return [...map.values()]
}

/**
 * Build the `fixtures/index.js` re-export file.
 *
 * @param stateMachineNames State machine names to re-export.
 * @returns The generated index file content.
 */
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
 * Build the `fixtures/index.js` re-export file.
 *
 * @param stateMachineNames State machine names to re-export.
 * @returns The generated index file content.
 */
function buildFixtureIndex(stateMachineNames: string[]): string {
    return `${stateMachineNames.map((stateMachineName) => `export * from './${slugify(stateMachineName)}.fixtures.js'`).join("\n")}\n`
}

/**
 * Create a fixture file stub for one step.
 *
 * @param step Step to render.
 * @returns The rendered fixture stub.
 */
function buildFunctionStub(step: Step): string {
    const paramsSignature = step.params.length > 0 ? `, ${step.params.join(", ")}` : ""
    return `export async function ${step.fixtureName}({ page }${paramsSignature}) {\n` +
        `    // TODO: Implement.\n` +
        `    console.log("NOT IMPLEMENTED: ${step.fixtureName}")\n` +
        `}\n`
}

/**
 * Build the content of one fixture file from its steps.
 *
 * @param stateMachineName State machine name used in the file header.
 * @param steps Steps for one state machine.
 * @returns Fixture file content.
 */
function buildFixtureFileContent(stateMachineName: string, steps: Step[]): string {
    const allSteps = sortedByName(deduplicateByName(steps))
    const givens = allSteps.filter((step) => step.keyword === "Given")
    const whens = allSteps.filter((step) => step.keyword === "When")
    const thens = allSteps.filter((step) => step.keyword === "Then")

    let content = `// ${stateMachineName} fixtures.\n`
    content += "// Implement each function to interact with the application under test.\n"
    if (givens.length > 0) {
        content += `\n// --- Set (Given) ---\n\n`
        content += givens.map(buildFunctionStub).join("\n")
    }
    if (whens.length > 0) {
        content += `\n// --- Make (When) ---\n\n`
        content += whens.map(buildFunctionStub).join("\n")
    }
    if (thens.length > 0) {
        content += `\n// --- Expect (Then) ---\n\n`
        content += thens.map(buildFunctionStub).join("\n")
    }
    return `${content}\n`
}

/**
 * Render one `.fixtures.js` file per state machine and a shared `index.js`.
 *
 * @param features Normalized feature data with generated steps.
 * @returns Generated fixture file content keyed by file name.
 */
export function renderFixtureFiles(features: Feature[]): Map<string, string> {
    const files = new Map<string, string>()
    const stateMachineNames = features
        .map((stateMachineData) => stateMachineData.stateMachine.name)
        .sort((left, right) => left.localeCompare(right))
    for (const stateMachineName of stateMachineNames) {
        const stateMachineData = features.find((entry) => entry.stateMachine.name === stateMachineName)
        if (stateMachineData !== undefined) {
            files.set(
                `${slugify(stateMachineName)}.fixtures.js`,
                buildFixtureFileContent(stateMachineName, stateMachineData.steps),
            )
        }
    }
    files.set("index.js", buildFixtureIndex(stateMachineNames))
    return files
}

/**
 * Write one `<slug>.fixtures.js` file per state machine into `fixturesDir`.
 *
 * @param features Normalized feature data with generated steps.
 * @param fixturesDir Output directory for fixture files.
 */
export function writeFixtureFiles(features: Feature[], fixturesDir: string): void {
    fs.mkdirSync(fixturesDir, { recursive: true })
    for (const [fileName, content] of renderFixtureFiles(features)) {
        const filePath = path.join(fixturesDir, fileName)
        fs.writeFileSync(filePath, content, "utf8")
        console.info(`Generated: \`${filePath}\``)
    }
}
