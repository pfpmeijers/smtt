import { type StateMachines, validateStateMachines } from "../../../parse"
import { buildFeatures } from "../../features"
import { renderFixtureFiles } from "../../fixtures"

/**
 * Validate and render fixture files, and return rendered content keyed by file name.
 *
 * @param stateMachines Input state-machine AST for the generator.
 * @returns Rendered fixture-file content keyed by file name.
 */
export function createFixtures(stateMachines: StateMachines): Record<string, string> {
    validateStateMachines(stateMachines)
    const features = buildFeatures(stateMachines)
    const fixturesMap = renderFixtureFiles(features)

    const fixturesRecord: Record<string, string> = {}
    for (const [fileName, content] of fixturesMap) {
        fixturesRecord[fileName] = content
    }
    return fixturesRecord
}
