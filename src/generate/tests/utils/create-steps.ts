import { type StateMachines, validateStateMachines } from "../../../parse"
import { buildFeatures } from "../../features"
import { renderStepFiles } from "../../steps"

/**
 * Validate and render step definition files, and return rendered content keyed by file name.
 *
 * @param stateMachines Input state-machine AST for the generator.
 * @returns Rendered step-file content keyed by file name.
 */
export function createSteps(stateMachines: StateMachines): Record<string, string> {
    validateStateMachines(stateMachines)
    const features = buildFeatures(stateMachines)
    const stepsMap = renderStepFiles(features)

    const stepsRecord: Record<string, string> = {}
    for (const [fileName, content] of stepsMap) {
        stepsRecord[fileName] = content
    }
    return stepsRecord
}
