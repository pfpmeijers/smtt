import type { Feature, Step } from "./features"

/** Rendered `When` step patterns shared by more than one state machine, and their merged step data. */
export interface SharedTriggerSteps {
    steps: Step[]
    patterns: Set<string>
}

/** One state machine's registration of a `When` step. */
interface TriggerOccurrence {
    stateMachineName: string
    step: Step
}

/**
 * The key a `When` step is grouped by: the resolved event trigger's name, so every rendered
 * variant of one event — bare and with arguments — shares one group (REQ-229). Older step data
 * without a trigger name falls back to its rendered pattern.
 *
 * @param step Step to key.
 * @returns The group key.
 */
function triggerKey(step: Step): string {
    return (step.triggerName ?? step.pattern).toLowerCase()
}

/**
 * Merge every registration of one rendered pattern into a single step: the widest parameter list
 * (REQ-234) and the transition ids contributed by all of them (REQ-235).
 *
 * @param pattern The rendered step pattern.
 * @param occurrences Registrations of that pattern.
 * @returns One merged step.
 */
function mergeOccurrences(pattern: string, occurrences: TriggerOccurrence[]): Step {
    const widestParams = occurrences.reduce(
        (widest, occurrence) => (occurrence.step.params.length > widest.length ? occurrence.step.params : widest),
        [] as string[],
    )
    const transitionsByStateMachine = new Map<string, string[]>()
    for (const occurrence of occurrences) {
        for (const [sourceStateMachineName, ids] of occurrence.step.transitionsByStateMachine) {
            const existing = transitionsByStateMachine.get(sourceStateMachineName)
            if (existing === undefined) {
                transitionsByStateMachine.set(sourceStateMachineName, [...ids])
            } else {
                existing.push(...ids)
            }
        }
    }
    return {
        keyword: "When",
        pattern,
        params: widestParams,
        fixtureName: occurrences[0].step.fixtureName,
        transitionsByStateMachine,
        triggerName: occurrences[0].step.triggerName,
    }
}

/**
 * Determine which event triggers are registered by more than one state machine, and merge the step
 * data of every rendered variant of those events into one entry per pattern (steps generation
 * REQ-229 up to REQ-236, fixtures generation REQ-318 up to REQ-323).
 *
 * Grouping is by trigger name rather than by rendered pattern: one event used with arguments by one
 * state machine and without them by another still renders two patterns, and both belong to the
 * shared file, because neither state machine owns the event.
 *
 * @param features Normalized feature data for all state machines.
 * @returns The merged shared steps and the set of patterns considered shared.
 */
export function collectSharedTriggerSteps(features: Feature[]): SharedTriggerSteps {
    const occurrencesByTrigger = new Map<string, TriggerOccurrence[]>()
    for (const feature of features) {
        for (const step of feature.steps) {
            if (step.keyword !== "When") continue
            const key = triggerKey(step)
            const occurrences = occurrencesByTrigger.get(key)
            const occurrence = { stateMachineName: feature.stateMachine.name, step }
            if (occurrences === undefined) {
                occurrencesByTrigger.set(key, [occurrence])
            } else {
                occurrences.push(occurrence)
            }
        }
    }

    const steps: Step[] = []
    const patterns = new Set<string>()
    for (const occurrences of occurrencesByTrigger.values()) {
        const stateMachineNames = new Set(occurrences.map((occurrence) => occurrence.stateMachineName))
        if (stateMachineNames.size < 2) continue

        const occurrencesByPattern = new Map<string, TriggerOccurrence[]>()
        for (const occurrence of occurrences) {
            const pattern = occurrence.step.pattern
            const patternOccurrences = occurrencesByPattern.get(pattern)
            if (patternOccurrences === undefined) {
                occurrencesByPattern.set(pattern, [occurrence])
            } else {
                patternOccurrences.push(occurrence)
            }
        }
        for (const [pattern, patternOccurrences] of occurrencesByPattern) {
            patterns.add(pattern)
            steps.push(mergeOccurrences(pattern, patternOccurrences))
        }
    }
    return { steps, patterns }
}

/**
 * Steps belonging to one state machine, excluding `When` steps promoted to the shared step/fixture
 * file because the event they render is registered by more than one state machine.
 *
 * @param feature Feature data for one state machine.
 * @param sharedPatterns Patterns already covered by the shared step/fixture file.
 * @returns The state machine's own steps.
 */
export function ownSteps(feature: Feature, sharedPatterns: Set<string>): Step[] {
    return feature.steps.filter((step) => step.keyword !== "When" || !sharedPatterns.has(step.pattern))
}
