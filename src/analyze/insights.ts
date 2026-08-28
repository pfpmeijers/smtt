/**
 * Insight derivation, cycle detection, and constraint diagnostics for state machines.
 */

import type { StateMachine } from "../parse"
import type {
    AnalysisInsights,
    ClassifiedTrigger,
    CycleRecord,
    DependencyTreeNode,
    ExistingPrecondition,
    ExplorationResult,
    MissingPreconditionRecord,
    MissingVariantGroup,
    NormalizedTransition,
    StateTriggerIssueRecord,
    StateTriggerIssues,
    UnhandledTriggerEntry,
    UncoveredPath,
} from "./types"

// --- Predecessor state coverage ---

/**
 * Returns the cross-state-machine precondition states required by transitions leading into `targetState`.
 *
 * @param targetState Target state name.
 * @param stateMachineName Owning state machine name.
 * @param normalizedTransitions Array of normalized transitions.
 * @returns Array of predecessor precondition descriptors.
 */
function collectPredecessorPreconditions(
    targetState: string,
    stateMachineName: string,
    normalizedTransitions: NormalizedTransition[]
): { state: string; stateMachine: string; predecessorId: string }[] {
    const inboundTransitions = normalizedTransitions.filter(
        transition =>
            transition.stateMachineName === stateMachineName &&
            transition.toState === targetState
    )
    const items: { state: string; stateMachine: string; predecessorId: string }[] = []

    for (const transition of inboundTransitions) {
        for (const precondition of transition.preconditions) {
            if (!precondition.unresolvable && precondition.stateMachine) {
                items.push({
                    state: precondition.state,
                    stateMachine: precondition.stateMachine,
                    predecessorId: transition.id,
                })
            }
        }
    }
    return items
}

/**
 * Computes the intersection of required predecessor states across all direct predecessor paths.
 *
 * @param byPredecessor Map of predecessor IDs to required state keys.
 * @returns Set of universally required state keys or `null`.
 */
function computeUniversalPredecessorKeys(
    byPredecessor: Map<string, Map<string, { state: string; stateMachine: string }>>
): Set<string> | null {
    let universallyRequired: Set<string> | null = null

    for (const preconditionMap of byPredecessor.values()) {
        const keySet = new Set<string>(preconditionMap.keys())
        if (universallyRequired === null) {
            universallyRequired = keySet
        } else {
            const intersection = new Set<string>()
            for (const key of universallyRequired) {
                if (keySet.has(key)) {
                    intersection.add(key)
                }
            }
            universallyRequired = intersection
        }
    }

    return universallyRequired
}

/**
 * Evaluates missing predecessor preconditions for one transition.
 *
 * @param transition Transition under inspection.
 * @param stateMachine Owning state machine.
 * @param normalizedTransitions All normalized transitions.
 * @param existingPreconditions Combined declared and default preconditions.
 * @param declaredKeys Set of declared precondition keys.
 * @returns Array of missing precondition records for this transition.
 */
function findGapsForTransition(
    transition: NormalizedTransition,
    stateMachine: StateMachine,
    normalizedTransitions: NormalizedTransition[],
    existingPreconditions: ExistingPrecondition[],
    declaredKeys: Set<string>
): MissingPreconditionRecord[] {
    if (transition.fromState === null) {
        return []
    }
    const predecessorPreconditions = collectPredecessorPreconditions(
        transition.fromState,
        transition.stateMachineName,
        normalizedTransitions
    )

    const byPredecessor = new Map<
        string,
        Map<string, { state: string; stateMachine: string }>
    >()
    for (const precondition of predecessorPreconditions) {
        if (!byPredecessor.has(precondition.predecessorId)) {
            byPredecessor.set(precondition.predecessorId, new Map())
        }
        const key = `${precondition.state}||${precondition.stateMachine}`
        byPredecessor.get(precondition.predecessorId)?.set(key, precondition)
    }

    const universallyRequired = computeUniversalPredecessorKeys(byPredecessor)
    if (!universallyRequired || universallyRequired.size === 0) {
        return []
    }

    const gaps: MissingPreconditionRecord[] = []
    for (const key of universallyRequired) {
        if (declaredKeys.has(key)) {
            continue
        }
        const samplePrecondition = [...byPredecessor.values()]
            .find(map => map.has(key))
            ?.get(key)
        if (!samplePrecondition) {
            continue
        }
        const predecessorIds = [...byPredecessor.keys()].filter(
            predecessorId => byPredecessor.get(predecessorId)?.has(key) ?? false
        )
        const alternatives = normalizedTransitions
            .filter(candidate => candidate.toState === samplePrecondition.state)
            .map(candidate => candidate.id)

        gaps.push({
            transitionId: transition.id,
            stateMachine: transition.stateMachineName,
            fromState: transition.fromState,
            trigger: transition.trigger.kind === "action" ? transition.trigger.text : "",
            existingPreconditions,
            missingState: samplePrecondition.state,
            missingStateMachine: samplePrecondition.stateMachine,
            predecessorIds,
            alternatives,
            suggestion: alternatives.length === 1 ? samplePrecondition.state : null,
            sourceFile: transition.sourceFile,
            lineNumber: transition.lineNumber,
        })
    }

    return gaps
}

/**
 * Identifies cross-state-machine predecessor states that are missing from event-triggered transitions.
 *
 * @param normalizedTransitions Classified transitions.
 * @param stateMachines Array of state machines.
 * @returns Array of missing precondition diagnostic records.
 */
export function computeMissingPreconditions(
    normalizedTransitions: NormalizedTransition[],
    stateMachines: StateMachine[]
): MissingPreconditionRecord[] {
    const gaps: MissingPreconditionRecord[] = []

    for (const transition of normalizedTransitions) {
        if (transition.trigger?.kind !== "action") {
            continue
        }

        const stateMachine = stateMachines.find(
            machine => machine.name === transition.stateMachineName
        )
        if (!stateMachine || stateMachine.initialState === transition.fromState) {
            continue
        }

        const defaultPreconditions: ExistingPrecondition[] = (
            stateMachine.defaultPreconditions ?? []
        ).map(precondition => ({ state: precondition.state, isDefault: true }))
        const declaredPreconditions: ExistingPrecondition[] = transition.preconditions
            .filter(precondition => !precondition.unresolvable)
            .map(precondition => ({ state: precondition.state, isDefault: false }))
        const existingPreconditions = [...defaultPreconditions, ...declaredPreconditions]

        const declaredKeys = new Set(
            transition.preconditions
                .filter(precondition => !precondition.unresolvable && precondition.stateMachine)
                .map(precondition => `${precondition.state}||${precondition.stateMachine}`)
        )
        for (const defaultPrecondition of stateMachine.defaultPreconditions ?? []) {
            declaredKeys.add(`${defaultPrecondition.state}||${stateMachine.name}`)
        }

        const transitionGaps = findGapsForTransition(
            transition,
            stateMachine,
            normalizedTransitions,
            existingPreconditions,
            declaredKeys
        )
        gaps.push(...transitionGaps)
    }

    return gaps
}

// --- State-trigger validity diagnostics ---

/**
 * Classifies inner paths of a state-trigger as covered or uncovered.
 *
 * @param innerTransitions Inbound transitions in the trigger state machine leading to the triggered state.
 * @param declaredStateMachines State machines currently in scope for the outer transition.
 * @returns Object with arrays of covered and uncovered inner transition paths.
 */
function classifyInnerPaths(
    innerTransitions: NormalizedTransition[],
    declaredStateMachines: Set<string>
): { coveredInner: NormalizedTransition[]; uncoveredInner: UncoveredPath[] } {
    const coveredInner: NormalizedTransition[] = []
    const uncoveredInner: UncoveredPath[] = []

    for (const inner of innerTransitions) {
        const undeclaredConstraints = inner.preconditions
            .filter(
                precondition =>
                    precondition.stateMachine &&
                    !declaredStateMachines.has(precondition.stateMachine)
            )
            .map(precondition => ({
                state: precondition.state,
                stateMachine: precondition.stateMachine ?? "",
            }))

        if (undeclaredConstraints.length === 0) {
            coveredInner.push(inner)
        } else {
            uncoveredInner.push({
                sourceTransitionId: inner.id,
                sourceTrigger: inner.trigger,
                undeclaredConstraints,
            })
        }
    }

    return { coveredInner, uncoveredInner }
}

/**
 * Analyses state-triggers and classifies them as ambiguous or invalid based on inner path coverage.
 *
 * @param normalizedTransitions Array of normalized transitions.
 * @returns Object containing ambiguous and invalid state-trigger records.
 */
export function computeStateTriggerIssues(
    normalizedTransitions: NormalizedTransition[]
): StateTriggerIssues {
    const ambiguousStateTriggers: StateTriggerIssueRecord[] = []
    const invalidStateTriggers: StateTriggerIssueRecord[] = []

    for (const transition of normalizedTransitions) {
        if (transition.trigger?.kind !== "state-trigger") {
            continue
        }

        const declaredStateMachines = new Set([
            transition.stateMachineName,
            transition.trigger.stateMachine,
            ...transition.preconditions
                .filter(precondition => precondition.stateMachine)
                .map(precondition => precondition.stateMachine as string),
        ])

        const triggeredState = transition.trigger.state
        const triggerStateMachine = transition.trigger.stateMachine

        const innerTransitions = normalizedTransitions.filter(
            source =>
                source.stateMachineName === triggerStateMachine &&
                source.toState === triggeredState &&
                source.fromState !== triggeredState
        )

        if (innerTransitions.length === 0) {
            continue
        }

        const { coveredInner, uncoveredInner } = classifyInnerPaths(
            innerTransitions,
            declaredStateMachines
        )

        if (coveredInner.length === 0 && uncoveredInner.length > 0) {
            invalidStateTriggers.push({
                transitionId: transition.id,
                stateMachine: transition.stateMachineName,
                triggeredState,
                triggerStateMachine,
                paths: uncoveredInner,
                sourceFile: transition.sourceFile,
                lineNumber: transition.lineNumber,
            })
        } else if (uncoveredInner.length > 0) {
            ambiguousStateTriggers.push({
                transitionId: transition.id,
                stateMachine: transition.stateMachineName,
                triggeredState,
                triggerStateMachine,
                ambiguousPaths: uncoveredInner,
                sourceFile: transition.sourceFile,
                lineNumber: transition.lineNumber,
            })
        }
    }

    return { ambiguousStateTriggers, invalidStateTriggers }
}

// --- Insight derivation and cycle collection ---

/**
 * Walks dependency trees and collects all transition nodes flagged with cycles.
 *
 * @param dependencyTrees Map of root transition IDs to dependency tree nodes.
 * @returns Array of cycle records.
 */
export function collectCycles(
    dependencyTrees: Record<string, DependencyTreeNode>
): CycleRecord[] {
    const cycles: CycleRecord[] = []
    const seen = new Set<string>()

    function walk(node: DependencyTreeNode | undefined): void {
        if (!node || seen.has(node.transitionId)) {
            return
        }
        seen.add(node.transitionId)
        if (node.cycle) {
            cycles.push({ transitionId: node.transitionId })
            return
        }
        for (const preconditionNode of node.preconditionNodes ?? []) {
            for (const child of preconditionNode.satisfiedBy ?? []) {
                walk(child)
            }
        }
        for (const child of node.triggerNode?.satisfiedBy ?? []) {
            walk(child)
        }
    }

    for (const tree of Object.values(dependencyTrees)) {
        walk(tree)
    }
    return cycles
}

/**
 * Groups unhandled trigger entries by state machine and trigger, deriving missing transition variant groups.
 *
 * @param unhandledTriggers Array of unhandled trigger entries.
 * @returns Array of missing variant groups.
 */
export function deriveMissingVariants(
    unhandledTriggers: UnhandledTriggerEntry[]
): MissingVariantGroup[] {
    const groups = new Map<
        string,
        {
            stateMachine: string
            trigger: ClassifiedTrigger
            transitionIds: Set<string>
            variants: UnhandledTriggerEntry["failingPreconditions"][]
        }
    >()

    for (const entry of unhandledTriggers) {
        const triggerKey =
            entry.trigger.kind === "state-trigger" ? entry.trigger.state : entry.trigger.text
        const groupKey = `${entry.stateMachine}||${triggerKey}`

        if (!groups.has(groupKey)) {
            groups.set(groupKey, {
                stateMachine: entry.stateMachine,
                trigger: entry.trigger,
                transitionIds: new Set(),
                variants: [],
            })
        }
        const group = groups.get(groupKey)
        if (!group) {
            continue
        }
        group.transitionIds.add(entry.transitionId)
        const preconditionSignature = JSON.stringify(entry.failingPreconditions)
        if (!group.variants.some(variant => JSON.stringify(variant) === preconditionSignature)) {
            group.variants.push(entry.failingPreconditions)
        }
    }

    return [...groups.values()].map(group => ({
        ...group,
        transitionIds: [...group.transitionIds].sort(),
    }))
}

/**
 * Checks if an unhandled trigger matches an impossible or irrelevant declaration.
 *
 * @param entry Unhandled trigger entry.
 * @param declarations Array of impossible/irrelevant trigger declarations.
 * @returns `true` if declared, `false` otherwise.
 */
function matchesDeclaredUnhandled(
    entry: UnhandledTriggerEntry,
    declarations: Array<{ trigger: string | { name?: string }; states?: string[]; state?: string[] }>
): boolean {
    if (!declarations.length) {
        return false
    }
    const triggerText =
        entry.trigger.kind === "state-trigger" ? entry.trigger.state : entry.trigger.text
    const actualStates = new Set(
        entry.failingPreconditions.map(precondition => (precondition.actual ?? "").toLowerCase())
    )

    return declarations.some(declaration => {
        const declarationTrigger =
            typeof declaration.trigger === "string"
                ? declaration.trigger
                : declaration.trigger?.name ?? ""
        const declarationStates = declaration.state ?? declaration.states ?? []
        return (
            declarationTrigger.toLowerCase() === triggerText.toLowerCase() &&
            declarationStates.every(precondition =>
                actualStates.has(String(precondition).toLowerCase())
            )
        )
    })
}

/**
 * Derives comprehensive analysis insights from exploration and static checks.
 *
 * @param normalizedTransitions All normalized transitions.
 * @param stateMachines Array of state machines.
 * @param explorationResult Output from BFS state exploration.
 * @param dependencyTrees AND/OR dependency trees keyed by transition ID.
 * @returns Aggregated analysis insights.
 */
export function deriveInsights(
    normalizedTransitions: NormalizedTransition[],
    stateMachines: StateMachine[],
    explorationResult: ExplorationResult,
    dependencyTrees: Record<string, DependencyTreeNode>
): AnalysisInsights {
    const { reachableTransitions, reachableGlobalStates, unhandledTriggers, truncated } =
        explorationResult

    const impossibleByStateMachine = new Map<
        string,
        Array<{ trigger: string | { name?: string }; states?: string[] }>
    >()
    for (const stateMachine of stateMachines) {
        const declared = stateMachine.impossible?.defined ?? []
        const inferred = stateMachine.impossible?.inferred ?? []
        const allImpossible = [...declared, ...inferred]
        if (allImpossible.length) {
            impossibleByStateMachine.set(stateMachine.name, allImpossible)
        }
    }

    const irrelevantByStateMachine = new Map<
        string,
        Array<{ trigger: string | { name?: string }; states?: string[] }>
    >()
    for (const stateMachine of stateMachines) {
        const declared = stateMachine.irrelevant
        if (declared?.length) {
            irrelevantByStateMachine.set(stateMachine.name, declared)
        }
    }

    const isImpossible = (entry: UnhandledTriggerEntry) =>
        matchesDeclaredUnhandled(entry, impossibleByStateMachine.get(entry.stateMachine) ?? [])
    const isIrrelevant = (entry: UnhandledTriggerEntry) =>
        matchesDeclaredUnhandled(entry, irrelevantByStateMachine.get(entry.stateMachine) ?? [])

    const filteredUnhandled = unhandledTriggers.filter(
        entry => !isImpossible(entry) && !isIrrelevant(entry)
    )
    const irrelevantTriggers = unhandledTriggers.filter(
        entry => isIrrelevant(entry) && !isImpossible(entry)
    )

    const deadTransitions = normalizedTransitions.filter(
        transition => !reachableTransitions.has(transition.id)
    )

    const unreachableStates: Record<string, string[]> = {}
    stateMachines.forEach((stateMachine, stateMachineIndex) => {
        const reachableInStateMachine = new Set(
            reachableGlobalStates.map(vector => vector[stateMachineIndex])
        )
        const unreachable = stateMachine.states
            .map(state => (typeof state === "string" ? state : state?.name))
            .filter(
                (stateName): stateName is string =>
                    Boolean(stateName) && !reachableInStateMachine.has(stateName)
            )
        if (unreachable.length > 0) {
            unreachableStates[stateMachine.name] = unreachable
        }
    })

    const { ambiguousStateTriggers, invalidStateTriggers } =
        computeStateTriggerIssues(normalizedTransitions)

    return {
        totalTransitions: normalizedTransitions.length,
        reachableCount: reachableTransitions.size,
        deadTransitions,
        unreachableStates,
        unhandledTriggers: filteredUnhandled,
        irrelevantTriggers,
        missingVariants: deriveMissingVariants(filteredUnhandled),
        cycles: collectCycles(dependencyTrees),
        missingPreconditions: computeMissingPreconditions(normalizedTransitions, stateMachines),
        ambiguousStateTriggers,
        invalidStateTriggers,
        truncated,
    }
}
