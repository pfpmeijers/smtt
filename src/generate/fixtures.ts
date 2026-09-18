import * as fs from "fs"
import * as path from "path"
import type { Feature, Step } from "./features"
import { collectSharedTriggerSteps, ownSteps } from "./sharing"

/** File name of the shared fixture file holding `When` fixtures used by more than one state machine. */
const SHARED_FIXTURES_FILE_NAME = "shared.fixtures.js"

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
 * @param includeShared Whether a shared fixture file was generated and should also be re-exported
 *   (REQ-322).
 * @returns The generated index file content.
 */
function buildFixtureIndex(stateMachineNames: string[], includeShared: boolean): string {
    const exports = stateMachineNames.map(
        (stateMachineName) => `export * from './${slugify(stateMachineName)}.fixtures.js'`,
    )
    if (includeShared) exports.push(`export * from './${SHARED_FIXTURES_FILE_NAME}'`)
    return `${exports.join("\n")}\n`
}

/**
 * Create a fixture file stub for one step.
 *
 * @param step Step to render.
 * @returns The rendered fixture stub.
 */
function buildFunctionStub(step: Step): string {
    const structArgs = step.params.length > 0 ? `page, ${step.params.join(", ")}` : "page"
    return `export async function ${step.fixtureName}({ ${structArgs} }) {\n` +
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
 * Build the content of the shared fixture file: a single `Make (When)` section holding the
 * trigger fixtures registered by more than one state machine (REQ-318/319/320).
 *
 * @param sharedWhenSteps Merged `When` steps shared by more than one state machine.
 * @returns Shared fixture file content.
 */
function buildSharedFixtureFileContent(sharedWhenSteps: Step[]): string {
    const whens = sortedByName(deduplicateByName(sharedWhenSteps))
    let content = "// Shared trigger fixtures.\n"
    content += "// Implement each function to interact with the application under test.\n"
    content += "\n// --- Make (When) ---\n\n"
    content += whens.map(buildFunctionStub).join("\n")
    return `${content}\n`
}

/**
 * Render one `.fixtures.js` file per state machine, a shared fixture file for `When` fixtures
 * registered by more than one state machine (REQ-318 up to REQ-323), and a shared `index.js`.
 *
 * @param features Normalized feature data with generated steps.
 * @returns Generated fixture file content keyed by file name.
 */
export function renderFixtureFiles(features: Feature[]): Map<string, string> {
    const files = new Map<string, string>()
    const entries = collectFixtureFileEntries(features)
    for (const [fileName, entry] of entries) {
        files.set(fileName, entry.content)
    }
    const stateMachineNames = features
        .map((stateMachineData) => stateMachineData.stateMachine.name)
        .sort((left, right) => left.localeCompare(right))
    files.set("index.js", buildFixtureIndex(stateMachineNames, entries.has(SHARED_FIXTURES_FILE_NAME)))
    return files
}

/** One fixture file's rendered content plus the individual stubs it is made of. */
interface FixtureFileEntry {
    content: string
    steps: Step[]
}

/**
 * Compute, per fixture file, both its freshly rendered content (used when the file does not yet
 * exist on disk) and the deduplicated steps it is built from (used to detect which stubs are
 * already present in an existing file, so `writeFixtureFiles` only appends what is missing).
 *
 * @param features Normalized feature data with generated steps.
 * @returns Fixture file entries keyed by file name.
 */
function collectFixtureFileEntries(features: Feature[]): Map<string, FixtureFileEntry> {
    const files = new Map<string, FixtureFileEntry>()
    const { steps: sharedWhenSteps, patterns: sharedPatterns } = collectSharedTriggerSteps(features)
    const stateMachineNames = features
        .map((stateMachineData) => stateMachineData.stateMachine.name)
        .sort((left, right) => left.localeCompare(right))
    for (const stateMachineName of stateMachineNames) {
        const stateMachineData = features.find((entry) => entry.stateMachine.name === stateMachineName)
        if (stateMachineData !== undefined) {
            const steps = sortedByName(deduplicateByName(ownSteps(stateMachineData, sharedPatterns)))
            files.set(`${slugify(stateMachineName)}.fixtures.js`, {
                content: buildFixtureFileContent(stateMachineName, steps),
                steps,
            })
        }
    }
    if (sharedWhenSteps.length > 0) {
        const steps = sortedByName(deduplicateByName(sharedWhenSteps))
        files.set(SHARED_FIXTURES_FILE_NAME, {
            content: buildSharedFixtureFileContent(steps),
            steps,
        })
    }
    return files
}

/**
 * Write one `<slug>.fixtures.js` file per state machine into `fixturesDir`, plus the shared
 * fixture file and `fixtures/index.js`.
 *
 * Fixture files are the manually implemented adapter layer (see `README.md`, "Execution
 * Architecture: The 3-Tier 'Generation Gap' Pattern"), so `generate` must never discard work
 * already done in them. A file that does not exist yet is created with every stub; a file that
 * already exists is left untouched except for appending stubs for functions it does not yet
 * define (REQ-446 up to REQ-450, matching `smtt generate --help`: "stubs appended only").
 *
 * @param features Normalized feature data with generated steps.
 * @param fixturesDir Output directory for fixture files.
 */
export function writeFixtureFiles(features: Feature[], fixturesDir: string): void {
    fs.mkdirSync(fixturesDir, { recursive: true })
    const entries = collectFixtureFileEntries(features)
    const fileNames: string[] = []
    for (const [fileName, entry] of entries) {
        fileNames.push(fileName)
        writeOrUpdateFixtureFile(path.join(fixturesDir, fileName), entry)
    }
    writeOrUpdateFixtureIndex(path.join(fixturesDir, "index.js"), fileNames)
}

/**
 * Create a fixture file if it does not exist yet, or append stubs for any of its steps whose
 * function is not already defined in the file. Never touches or removes existing content
 * (REQ-446 up to REQ-449).
 *
 * @param filePath Path of the `.fixtures.js` file to write or update.
 * @param entry Freshly rendered content and steps for that file.
 */
function writeOrUpdateFixtureFile(filePath: string, entry: FixtureFileEntry): void {
    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, entry.content, "utf8")
        console.info(`Generated: \`${filePath}\``)
        return
    }

    const existing = fs.readFileSync(filePath, "utf8")
    const missingSteps = entry.steps.filter((step) => !existing.includes(`export async function ${step.fixtureName}(`))
    if (missingSteps.length === 0) {
        console.info(`Up to date: \`${filePath}\``)
        return
    }

    const stubs = missingSteps.map(buildFunctionStub).join("\n")
    const updated = `${existing.trimEnd()}\n\n// --- TODO ---\n\n${stubs}\n`
    fs.writeFileSync(filePath, updated, "utf8")
    console.info(`Updated: \`${filePath}\` (added ${missingSteps.length} stub${missingSteps.length === 1 ? "" : "s"})`)
}

/**
 * Create `fixtures/index.js` if it does not exist yet, or append re-export lines for any fixture
 * file that is not already re-exported. Never touches or removes existing lines (REQ-450).
 *
 * @param indexPath Path of the `fixtures/index.js` file to write or update.
 * @param fileNames Fixture file names that must be re-exported.
 */
function writeOrUpdateFixtureIndex(indexPath: string, fileNames: string[]): void {
    const exportLines = fileNames.map((fileName) => `export * from './${fileName}'`)
    if (!fs.existsSync(indexPath)) {
        fs.writeFileSync(indexPath, `${exportLines.join("\n")}\n`, "utf8")
        console.info(`Generated: \`${indexPath}\``)
        return
    }

    const existing = fs.readFileSync(indexPath, "utf8")
    const missingLines = exportLines.filter((line) => !existing.includes(line))
    if (missingLines.length === 0) {
        console.info(`Up to date: \`${indexPath}\``)
        return
    }

    const updated = `${existing.trimEnd()}\n${missingLines.join("\n")}\n`
    fs.writeFileSync(indexPath, updated, "utf8")
    console.info(`Updated: \`${indexPath}\``)
}
