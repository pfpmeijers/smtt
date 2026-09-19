import { annotateImpliedStates, type StateMachines } from "../../../parse"
import { generateTransitionIds } from "../../../parse/complete"
import { renderFeatures } from "../../features"
import { slugifyName } from "./test"

/**
 * Render feature files and return content keyed by original state-machine
 * name.
 *
 * @param stateMachines Input state-machine AST for the generator.
 * @returns Rendered feature content keyed by each state-machine `name`.
 */
export function createFeatures(stateMachines: StateMachines): Record<string, string> {
    // Hand-built ASTs skip the parse step's completion, so give anonymous transitions the ids it would (REQ-454).
    generateTransitionIds(stateMachines)
    // ...and the implied states the parse step records on each transition (REQ-456).
    annotateImpliedStates(stateMachines)
    const featuresMap = renderFeatures(stateMachines)

    const featuresRecord: Record<string, string> = {}
    for (const stateMachine of stateMachines) {
        const content = featuresMap.get(slugifyName(stateMachine.name))
        if (content !== undefined) {
            featuresRecord[stateMachine.name] = content
        }
    }
    return featuresRecord
}
