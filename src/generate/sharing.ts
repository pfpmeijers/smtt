import type { Feature, Step } from "./features"

/** Rendered `When` step patterns shared by more than one state machine, and their merged step data. */
export interface SharedTriggerSteps {
    steps: Step[]
    patterns: Set<string>
}

/**
 * Determine which rendered `When` step patterns are registered by more than one state machine, and
 * merge their step data into one entry per pattern (steps generation REQ-229 up to REQ-236,
 * fixtures generation REQ-318 up to REQ-323).
 *
 * @param features Normalized feature data for all state machines.
 * @returns The merged shared steps and the set of patterns considered shared.
 */
export function collectSharedTriggerSteps(features: Feature[]): SharedTriggerSteps {
    const occurrencesByPattern = new Map<string, Step[]>()
    for (const feature of features) {
        for (const step of feature.steps) {
            if (step.keyword !== "When") continue
            const occurrences = occurrencesByPattern.get(step.pattern)
            if (occurrences === undefined) {
                occurrencesByPattern.set(step.pattern, [step])
            } else {
                occurrences.push(step)
            }
        }
    }

    const steps: Step[] = []
    const patterns = new Set<string>()
    for (const [pattern, occurrences] of occurrencesByPattern) {
        if (occurrences.length < 2) continue
        patterns.add(pattern)
        const widestParams = occurrences.reduce(
            (widest, step) => (step.params.length > widest.length ? step.params : widest),
            [] as string[],
        )
        steps.push({
            keyword: "When",
            pattern,
            params: widestParams,
            fixtureName: occurrences[0].fixtureName,
            transitionIds: occurrences.flatMap((step) => step.transitionIds),
        })
    }
    return { steps, patterns }
}

/**
 * Steps belonging to one state machine, excluding `When` steps promoted to the shared step/fixture
 * file because more than one state machine registers the same pattern.
 *
 * @param feature Feature data for one state machine.
 * @param sharedPatterns Patterns already covered by the shared step/fixture file.
 * @returns The state machine's own steps.
 */
export function ownSteps(feature: Feature, sharedPatterns: Set<string>): Step[] {
    return feature.steps.filter((step) => step.keyword !== "When" || !sharedPatterns.has(step.pattern))
}
