import { mkdirSync } from "fs"
import { join as joinPath } from "path"
import { buildFeatures, writeFeatureFiles } from "./features"
import { writeStepFiles } from "./steps"
import { writeFixtureFiles } from "./fixtures"
import { writeGenerateDebugFile } from "./debug"
import { loadStateMachines } from "../parse"
import { FEATURES_DIR, STEPS_DIR, FIXTURES_DIR } from "../common/dirs"

export interface GenerateOptions {
    debug?: boolean
}

/**
 * Reads the parsed AST JSON at `jsonPath`, generates feature files,
 * step definitions and fixture stubs into `outputDir`.
 *
 * The `jsonPath` is expected to contain a JSON file that has already been
 * validated against the AST schema and additional semantical constraints.
 * (Validation is performed during parsing; see `parse.ts`).
 * This function does not re-validate the input.
 *
 * @param jsonPath Path to the parsed AST JSON file.
 * @param outputDir Base directory that receives the generated artifacts.
 * @param options Optional generation flags.
 */
export function generate(jsonPath: string, outputDir: string, options: GenerateOptions = {}): void {
    const stateMachines = loadStateMachines(jsonPath)
    mkdirSync(outputDir, { recursive: true })

    if (options.debug) {
        writeGenerateDebugFile(stateMachines, outputDir)
    }

    const features = buildFeatures(stateMachines)

    const featuresDir = joinPath(outputDir, FEATURES_DIR)
    mkdirSync(featuresDir, { recursive: true })
    writeFeatureFiles(features, featuresDir)

    const stepsDir = joinPath(outputDir, STEPS_DIR)
    mkdirSync(stepsDir, { recursive: true })
    writeStepFiles(features, stepsDir)

    const fixturesDir = joinPath(outputDir, FIXTURES_DIR)
    mkdirSync(fixturesDir, { recursive: true })
    writeFixtureFiles(features, fixturesDir)
}
