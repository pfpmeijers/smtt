/**
 * Normalization and static dependency graph construction for state machines.
 */

import type { StateMachine, StateRef, Transition, Trigger } from "../parse"
import type {
    ClassifiedTrigger,
    DependencyTreeNode,
    DependencyTreePreconditionNode,
    DependencyTreeTriggerNode,
    NormalizedTransition,
    Precondition,
    StateIndexEntry,
} from "./types"

// --- State and transition index builders ---

/**
 * Builds a map from lowercased state name to its owning state machine and canonical state name.
 * Relies on the global-uniqueness guarantee enforced by the parser.
 *
 * @param stateMachines Array of parsed state machine AST objects.
 * @returns Map from lowercase state name to `StateIndexEntry`.
 */
export function buildStateIndex(stateMachines: StateMachine[]): Map<string, StateIndexEntry> {
    const index = new Map<string, StateIndexEntry>()

    for (const stateMachine of stateMachines) {
        for (const state of stateMachine.states ?? []) {
            const stateName = typeof state === "string" ? state : state?.name
            if (!stateName) {
                continue
            }
            index.set(String(stateName).toLowerCase(), {
                stateMachine,
                state: stateName,
            })
        }
    }

    return index
}

/**
 * Classifies one trigger item as either an inter-state-machine `state-trigger` or an external `action` trigger.
 *
 * @param triggerItem Raw trigger object from the transition.
 * @param ownerStateMachineName Name of the state machine owning this transition.
 * @param stateToStateMachine Map from lowercase state name to `StateIndexEntry`.
 * @returns Classified trigger descriptor.
 */
export function classifyTrigger(
    triggerItem: (Trigger & { state?: string }) | null | undefined,
    ownerStateMachineName: string,
    stateToStateMachine: Map<string, StateIndexEntry>
): ClassifiedTrigger {
    const rawTriggerName = triggerItem?.state ?? triggerItem?.name
    if (!rawTriggerName) {
        return { kind: "action", text: "" }
    }

    const lowerName = rawTriggerName.toLowerCase()
    const entry = stateToStateMachine.get(lowerName)
    if (entry && entry.stateMachine.name !== ownerStateMachineName) {
        return {
            kind: "state-trigger",
            stateMachine: entry.stateMachine.name,
            state: entry.state,
            arguments: triggerItem?.arguments ?? null,
        }
    }

    return { kind: "action", text: rawTriggerName }
}

/**
 * Resolves the `fromState` and precondition list from the transition state references.
 *
 * @param stateReferences Array of state references attached to the transition.
 * @param ownStateNames Set of lowercase state names belonging to the owning state machine.
 * @param stateToStateMachine Map from lowercase state name to `StateIndexEntry`.
 * @returns Object with resolved `fromState` and `preconditions`.
 */
function resolvePreconditionsAndFromState(
    stateReferences: StateRef[],
    ownStateNames: Set<string>,
    stateToStateMachine: Map<string, StateIndexEntry>
): { fromState: string | null; preconditions: Precondition[] } {
    const ownStateReference = stateReferences.find(reference =>
        ownStateNames.has(reference?.name?.toLowerCase())
    )
    const fromState = ownStateReference?.name ?? stateReferences[0]?.name ?? null
    const preconditions: Precondition[] = []

    for (const stateReference of stateReferences) {
        if (!stateReference?.name || stateReference.name === fromState) {
            continue
        }
        const entry = stateToStateMachine.get(stateReference.name.toLowerCase())
        preconditions.push({
            state: stateReference.name,
            stateMachine: entry ? entry.stateMachine.name : null,
            unresolvable: !entry,
        })
    }

    return { fromState, preconditions }
}

/**
 * Converts one raw transition AST object into explicit `fromState`, `toState`,
 * `preconditions`, and classified `trigger` fields.
 *
 * @param rawTransition Raw transition AST object with state machine context.
 * @param stateToStateMachine Map from lowercase state name to `StateIndexEntry`.
 * @returns Object with normalized transition fields.
 */
export function classifyTransition(
    rawTransition: Transition & {
        stateMachineName: string
        ownStateNames?: Set<string>
        sourceFile?: string
        lineNumber?: number
        toState?: string
        to?: string
    },
    stateToStateMachine: Map<string, StateIndexEntry>
): {
    fromState: string | null
    toState: string | null
    preconditions: Precondition[]
    trigger: ClassifiedTrigger
} {
    const toState =
        rawTransition.result?.name ?? rawTransition.toState ?? rawTransition.to ?? null
    const stateReferences = Array.isArray(rawTransition.states) ? rawTransition.states : []
    const ownStateNames = rawTransition.ownStateNames ?? new Set<string>()

    const { fromState, preconditions } = resolvePreconditionsAndFromState(
        stateReferences,
        ownStateNames,
        stateToStateMachine
    )

    const trigger = classifyTrigger(
        rawTransition.trigger,
        rawTransition.stateMachineName,
        stateToStateMachine
    )

    return { fromState, toState, preconditions, trigger }
}

/**
 * Builds a flat list of all transitions across all state machines.
 *
 * @param stateMachines Array of parsed state machine objects.
 * @param stateToStateMachine Map from lowercase state name to `StateIndexEntry`.
 * @returns Flat array of normalized transitions.
 */
export function buildAllNormalizedTransitions(
    stateMachines: StateMachine[],
    stateToStateMachine: Map<string, StateIndexEntry>
): NormalizedTransition[] {
    const normalizedList: NormalizedTransition[] = []

    for (const stateMachine of stateMachines) {
        const ownStateNames = new Set(
            (stateMachine.states ?? [])
                .map(state => (typeof state === "string" ? state : state?.name)?.toLowerCase())
                .filter(Boolean)
        )

        const transitions = stateMachine.transitions ?? []
        transitions.forEach((transition, index) => {
            const rawWithContext = {
                id: `${stateMachine.name}#${index}`,
                stateMachineName: stateMachine.name,
                ownStateNames,
                ...transition,
            }
            const classified = classifyTransition(rawWithContext, stateToStateMachine)

            normalizedList.push({
                id: rawWithContext.id,
                stateMachineName: stateMachine.name,
                notes: transition.notes,
                source: stateMachine.source ?? undefined,
                sourceFile: stateMachine.source ?? undefined,
                lineNumber: transition.sourceLine ?? undefined,
                ...classified,
            })
        })
    }

    return normalizedList
}

/**
 * Returns a map from transition ID to normalized transition for constant-time lookup.
 *
 * @param normalizedTransitions Classified transition list.
 * @returns Map from transition ID to normalized transition.
 */
export function buildTransitionById(
    normalizedTransitions: NormalizedTransition[]
): Map<string, NormalizedTransition> {
    const transitionById = new Map<string, NormalizedTransition>()
    for (const transition of normalizedTransitions) {
        transitionById.set(transition.id, transition)
    }
    return transitionById
}

// --- Phase 1: Static dependency tracer ---

/**
 * Builds the trigger-side node of the dependency tree for a trigger descriptor.
 *
 * @param trigger Classified trigger descriptor.
 * @param normalizedTransitions All classified transitions.
 * @param transitionById Map from transition ID to transition.
 * @param childStack Stack of ancestor transition IDs.
 * @returns Dependency tree trigger node or `null`.
 */
function buildTriggerNode(
    trigger: ClassifiedTrigger,
    normalizedTransitions: NormalizedTransition[],
    transitionById: Map<string, NormalizedTransition>,
    childStack: string[]
): DependencyTreeTriggerNode | null {
    if (!trigger) {
        return null
    }
    if (trigger.kind === "action") {
        return { kind: "action", text: trigger.text }
    }

    const satisfiedBy = normalizedTransitions
        .filter(candidate => candidate.toState === trigger.state)
        .map(candidate =>
            traceDependencies(candidate.id, normalizedTransitions, transitionById, childStack)
        )

    return {
        kind: "state-trigger",
        stateMachine: trigger.stateMachine,
        state: trigger.state,
        satisfiedBy,
    }
}

/**
 * Builds one precondition node containing the alternative paths satisfying the state requirement.
 *
 * @param precondition Single transition precondition.
 * @param normalizedTransitions All classified transitions.
 * @param transitionById Map from transition ID to transition.
 * @param childStack Stack of ancestor transition IDs.
 * @returns Precondition dependency tree node.
 */
function buildPreconditionNode(
    precondition: Precondition,
    normalizedTransitions: NormalizedTransition[],
    transitionById: Map<string, NormalizedTransition>,
    childStack: string[]
): DependencyTreePreconditionNode {
    const satisfiedBy = normalizedTransitions
        .filter(candidate => candidate.toState === precondition.state)
        .map(candidate =>
            traceDependencies(candidate.id, normalizedTransitions, transitionById, childStack)
        )

    return {
        state: precondition.state,
        stateMachine: precondition.stateMachine,
        satisfiedBy,
    }
}

/**
 * Recursively builds the AND/OR dependency tree rooted at `transitionId`.
 *
 * @param transitionId Stable ID of the transition to trace.
 * @param normalizedTransitions All classified transitions.
 * @param transitionById Map from transition ID to transition.
 * @param visitedStack Ancestor transition IDs on the current traversal path.
 * @returns Dependency tree node representing the sub-tree.
 */
export function traceDependencies(
    transitionId: string,
    normalizedTransitions: NormalizedTransition[],
    transitionById: Map<string, NormalizedTransition>,
    visitedStack: string[]
): DependencyTreeNode {
    if (visitedStack.includes(transitionId)) {
        return { transitionId, cycle: true }
    }

    const transition = transitionById.get(transitionId)
    if (!transition) {
        return { transitionId, cycle: false, error: "unknown transition" }
    }

    const childStack = [...visitedStack, transitionId]
    const triggerNode = buildTriggerNode(
        transition.trigger,
        normalizedTransitions,
        transitionById,
        childStack
    )
    const preconditionNodes = transition.preconditions.map(precondition =>
        buildPreconditionNode(precondition, normalizedTransitions, transitionById, childStack)
    )

    return {
        transitionId,
        stateMachine: transition.stateMachineName,
        fromState: transition.fromState,
        toState: transition.toState,
        triggerNode,
        preconditionNodes,
        cycle: false,
    }
}
