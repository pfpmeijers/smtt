/**
 * Inferrer module for post-processing `state-machines.json`.
 *
 * Reads the parsed AST, runs closed-world impossibility inference on each
 * state machine, and writes `impossible.inferred` back into the JSON file
 * next to the existing `impossible.defined` entries.
 *
 * Note: generation does not consume `impossible.inferred`; this data is mainly
 * used by analysis/reporting workflows.
 */

import { computeInferredImpossibilities } from "./impossibilities"
import { loadStateMachines, saveStateMachines } from "../parse";

/**
 * Runs closed-world impossibility inference for all state machines in a JSON file.
 *
 * Loads state machines from `jsonPath`, computes inferred impossible trigger/state
 * combinations per machine, writes them into `stateMachine.impossible.inferred`,
 * and persists the updated JSON back to the same path.
 *
 * Existing `impossible.defined` entries are preserved.
 *
 * @param jsonPath Absolute or relative path to a `state-machines.json` file.
 * @throws {Error} When the file cannot be read, parsed, or written.
 */
export function infer(jsonPath: string): void {
    const stateMachines = loadStateMachines(jsonPath)

    const inferredByMachine = computeInferredImpossibilities(stateMachines)
    for (const stateMachine of stateMachines) {
        // Preserve `defined`; add or replace `inferred` alongside it.
        if (!stateMachine.impossible) {
            stateMachine.impossible = { defined: [] }
        }
        stateMachine.impossible.inferred = inferredByMachine[stateMachine.name] ?? []
    }

    saveStateMachines(jsonPath, stateMachines)
    console.info(`Inferred: \`${jsonPath}\``)
}
