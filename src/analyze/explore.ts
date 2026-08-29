/**
 * Global BFS state-space exploration over state machine configurations.
 */

import type { StateMachine } from "../parse"
import type {
    ClassifiedTrigger,
    ExplorationResult,
    FailingPrecondition,
    NormalizedTransition,
    UnhandledTriggerEntry,
} from "./types.js"

// --- Helper functions for state vector conversion and trigger inspection ---

/**
 * Converts a global state vector to an object keyed by state machine name.
 *
 * @param vector State vector corresponding to state machines by index.
 * @param stateMachines Array of state machines in index order.
 * @returns Record mapping state machine name to current state.
 */
export function vectorToObject(
    vector: string[],
    stateMachines: StateMachine[]
): Record<string, string> {
    const stateObject: Record<string, string> = {}
    stateMachines.forEach((stateMachine, index) => {
        stateObject[stateMachine.name] = vector[index]
    })
    return stateObject
}

/**
 * Returns `true` when the trigger represents an externally driven event rather than an inter-state-machine trigger.
 *
 * @param trigger Classified trigger descriptor or `null`.
 * @returns `true` if event trigger, `false` otherwise.
 */
export function isEventTrigger(trigger: ClassifiedTrigger | null): boolean {
    return !trigger || trigger.kind === "action"
}

/**
 * Returns `true` when every precondition of the transition is satisfied in the current vector.
 *
 * @param transition Classified transition to test.
 * @param vector Current global state vector.
 * @param stateMachineToIndex Map from state machine name to index in the state vector.
 * @param triggerStateMachineName Name of the state machine whose trigger just fired.
 * @param preFireTriggerState State that state machine was in before firing.
 * @returns `true` if all preconditions hold, `false` otherwise.
 */
export function preconditionsMet(
    transition: NormalizedTransition,
    vector: string[],
    stateMachineToIndex: Map<string, number>,
    triggerStateMachineName: string | null = null,
    preFireTriggerState: string | null = null
): boolean {
    return transition.preconditions.every(precondition => {
        if (precondition.unresolvable) {
            return true
        }
        const stateMachineIndex = stateMachineToIndex.get(precondition.stateMachine ?? "")
        if (stateMachineIndex === undefined) {
            return false
        }
        const effectiveState =
            triggerStateMachineName && precondition.stateMachine === triggerStateMachineName
                ? preFireTriggerState
                : vector[stateMachineIndex]
        return effectiveState === precondition.state
    })
}

/**
 * Returns the list of preconditions from the transition that are not satisfied in the current vector.
 *
 * @param transition Classified transition to inspect.
 * @param vector Current global state vector.
 * @param stateMachineToIndex Map from state machine name to index in the state vector.
 * @param triggerStateMachineName Name of the state machine whose trigger just fired.
 * @param preFireTriggerState State that state machine was in before firing.
 * @returns Array of failing preconditions with required and actual states.
 */
export function unsatisfiedPreconditions(
    transition: NormalizedTransition,
    vector: string[],
    stateMachineToIndex: Map<string, number>,
    triggerStateMachineName: string | null = null,
    preFireTriggerState: string | null = null
): FailingPrecondition[] {
    return transition.preconditions
        .filter(precondition => {
            if (precondition.unresolvable) {
                return false
            }
            const stateMachineIndex = stateMachineToIndex.get(precondition.stateMachine ?? "")
            if (stateMachineIndex === undefined) {
                return true
            }
            const effectiveState =
                triggerStateMachineName && precondition.stateMachine === triggerStateMachineName
                    ? preFireTriggerState
                    : vector[stateMachineIndex]
            return effectiveState !== precondition.state
        })
        .map(precondition => {
            const stateMachineIndex = stateMachineToIndex.get(precondition.stateMachine ?? "")
            const effectiveState =
                triggerStateMachineName && precondition.stateMachine === triggerStateMachineName
                    ? preFireTriggerState
                    : stateMachineIndex !== undefined
                      ? vector[stateMachineIndex]
                      : null
            return {
                stateMachine: precondition.stateMachine,
                required: precondition.state,
                actual: effectiveState,
            }
        })
}

/**
 * Builds a diagnostic entry for an unhandled trigger condition.
 *
 * @param transition Failing transition.
 * @param vector State vector when failure occurred.
 * @param stateMachines Array of state machines in index order.
 * @param stateMachineToIndex Map from state machine name to state vector index.
 * @param triggerStateMachineName Optional trigger state machine name.
 * @param preFireTriggerState Optional pre-fire trigger state.
 * @returns Diagnostic `UnhandledTriggerEntry`.
 */
export function buildUnhandledEntry(
    transition: NormalizedTransition,
    vector: string[],
    stateMachines: StateMachine[],
    stateMachineToIndex: Map<string, number>,
    triggerStateMachineName: string | null = null,
    preFireTriggerState: string | null = null
): UnhandledTriggerEntry {
    return {
        transitionId: transition.id,
        stateMachine: transition.stateMachineName,
        fromState: transition.fromState,
        trigger: transition.trigger,
        globalState: vectorToObject(vector, stateMachines),
        failingPreconditions: unsatisfiedPreconditions(
            transition,
            vector,
            stateMachineToIndex,
            triggerStateMachineName,
            preFireTriggerState
        ),
        source: transition.source,
    }
}

/**
 * Builds an index from `"<triggerStateMachine>||<triggerState>"` to reactor transitions.
 *
 * @param normalizedTransitions Classified transitions.
 * @returns Map of trigger keys to reacting transitions.
 */
export function buildStateTriggerIndex(
    normalizedTransitions: NormalizedTransition[]
): Map<string, NormalizedTransition[]> {
    const index = new Map<string, NormalizedTransition[]>()
    for (const transition of normalizedTransitions) {
        if (transition.trigger?.kind !== "state-trigger") {
            continue
        }
        const key = `${transition.trigger.stateMachine}||${transition.trigger.state}`
        if (!index.has(key)) {
            index.set(key, [])
        }
        index.get(key)?.push(transition)
    }
    return index
}

// --- Reactor application ---

/**
 * Groups reactor transitions by their owning state machine and starting state.
 *
 * @param reactors Array of reacting transitions matching the triggered event.
 * @param vector Current global state vector.
 * @param stateMachineToIndex Map from state machine name to state vector index.
 * @returns Map of group keys to matching reactor transitions.
 */
function groupReactorsByStateMachineAndState(
    reactors: NormalizedTransition[],
    vector: string[],
    stateMachineToIndex: Map<string, number>
): Map<string, NormalizedTransition[]> {
    const groupedReactors = new Map<string, NormalizedTransition[]>()

    for (const reactor of reactors) {
        const reactorIndex = stateMachineToIndex.get(reactor.stateMachineName)
        if (reactorIndex === undefined || reactor.fromState !== vector[reactorIndex]) {
            continue
        }
        const groupKey = `${reactor.stateMachineName}||${reactor.fromState}`
        if (!groupedReactors.has(groupKey)) {
            groupedReactors.set(groupKey, [])
        }
        groupedReactors.get(groupKey)?.push(reactor)
    }

    return groupedReactors
}

/**
 * Evaluates one reactor group, advancing reachable state vectors or recording unhandled entries.
 *
 * @param group Array of variant reactor transitions for a state machine and from-state pair.
 * @param rootContext Context information regarding root state machine firing.
 * @param sharedContext Shared execution references.
 */
function evaluateReactorGroup(
    group: NormalizedTransition[],
    rootContext: { rootStateMachineName: string; preFireRootState: string },
    sharedContext: {
        vector: string[]
        jointVector: string[]
        stateMachines: StateMachine[]
        stateMachineToIndex: Map<string, number>
        reachableTransitions: Set<string>
        unhandledTriggers: UnhandledTriggerEntry[]
    }
): void {
    const metReactors: NormalizedTransition[] = []
    const failedReactors: NormalizedTransition[] = []

    for (const reactor of group) {
        const met = preconditionsMet(
            reactor,
            sharedContext.vector,
            sharedContext.stateMachineToIndex,
            rootContext.rootStateMachineName,
            rootContext.preFireRootState
        )
        if (met) {
            metReactors.push(reactor)
        } else {
            failedReactors.push(reactor)
        }
    }

    if (metReactors.length > 0) {
        for (const reactor of metReactors) {
            const reactorIndex = sharedContext.stateMachineToIndex.get(reactor.stateMachineName)
            if (reactorIndex === undefined || reactor.toState === null) {
                continue
            }
            sharedContext.reachableTransitions.add(reactor.id)
            sharedContext.jointVector[reactorIndex] = reactor.toState
        }
        return
    }

    for (const reactor of failedReactors) {
        sharedContext.unhandledTriggers.push(
            buildUnhandledEntry(
                reactor,
                sharedContext.vector,
                sharedContext.stateMachines,
                sharedContext.stateMachineToIndex,
                rootContext.rootStateMachineName,
                rootContext.preFireRootState
            )
        )
    }
}

/**
 * Fires all `state-trigger` reactor transitions triggered by a root state machine moving to `rootToState`.
 *
 * @param rootStateMachineName Name of the state machine that fired.
 * @param rootToState State the root state machine transitioned to.
 * @param preFireRootState State of the root state machine before the transition.
 * @param vector Global state vector before root state machine transition.
 * @param jointVector Mutable state vector with root state machine state updated.
 * @param stateMachines Array of state machines in index order.
 * @param stateMachineToIndex Map from state machine name to state vector index.
 * @param stateTriggerIndex Map from trigger key to reactor transitions.
 * @param reachableTransitions Set of reachable transition IDs.
 * @param unhandledTriggers Array of diagnostic unhandled trigger records.
 */
export function applyReactors(
    rootStateMachineName: string,
    rootToState: string,
    preFireRootState: string,
    vector: string[],
    jointVector: string[],
    stateMachines: StateMachine[],
    stateMachineToIndex: Map<string, number>,
    stateTriggerIndex: Map<string, NormalizedTransition[]>,
    reachableTransitions: Set<string>,
    unhandledTriggers: UnhandledTriggerEntry[]
): void {
    const reactors = stateTriggerIndex.get(`${rootStateMachineName}||${rootToState}`) ?? []
    const groupedReactors = groupReactorsByStateMachineAndState(
        reactors,
        vector,
        stateMachineToIndex
    )

    for (const group of groupedReactors.values()) {
        evaluateReactorGroup(
            group,
            { rootStateMachineName, preFireRootState },
            {
                vector,
                jointVector,
                stateMachines,
                stateMachineToIndex,
                reachableTransitions,
                unhandledTriggers,
            }
        )
    }
}

// --- BFS state space exploration ---

/**
 * Generates a trigger group key for transition variant grouping.
 *
 * @param transition Normalized transition.
 * @returns Grouping key.
 */
function toTriggerKey(transition: NormalizedTransition): string {
    if (!transition.trigger) {
        return "event||<implicit>"
    }
    if (transition.trigger.kind === "state-trigger") {
        return `state-trigger||${transition.trigger.stateMachine}||${transition.trigger.state}`
    }
    return `action||${transition.trigger.text}`
}

/**
 * Groups event transitions by their trigger key.
 *
 * @param candidates List of active event transition candidates.
 * @returns Map from trigger key to candidate transition array.
 */
function groupCandidatesByTrigger(
    candidates: NormalizedTransition[]
): Map<string, NormalizedTransition[]> {
    const grouped = new Map<string, NormalizedTransition[]>()
    for (const candidate of candidates) {
        const key = toTriggerKey(candidate)
        if (!grouped.has(key)) {
            grouped.set(key, [])
        }
        grouped.get(key)?.push(candidate)
    }
    return grouped
}

/**
 * Processes one candidate group during BFS exploration.
 *
 * @param group Candidate transitions with matching trigger.
 * @param stepContext Exploration step context parameters.
 */
function processCandidateGroup(
    group: NormalizedTransition[],
    stepContext: {
        vector: string[]
        rootIndex: number
        rootStateMachineName: string
        stateMachines: StateMachine[]
        stateMachineToIndex: Map<string, number>
        stateTriggerIndex: Map<string, NormalizedTransition[]>
        reachableTransitions: Set<string>
        reachableGlobalStates: string[][]
        unhandledTriggers: UnhandledTriggerEntry[]
        visited: Set<string>
        queue: string[][]
    }
): void {
    const metTransitions: NormalizedTransition[] = []
    const failedTransitions: NormalizedTransition[] = []

    for (const rootTransition of group) {
        const rootMet = preconditionsMet(
            rootTransition,
            stepContext.vector,
            stepContext.stateMachineToIndex
        )
        if (rootMet) {
            metTransitions.push(rootTransition)
        } else {
            failedTransitions.push(rootTransition)
        }
    }

    if (!metTransitions.length) {
        for (const failedTransition of failedTransitions) {
            stepContext.unhandledTriggers.push(
                buildUnhandledEntry(
                    failedTransition,
                    stepContext.vector,
                    stepContext.stateMachines,
                    stepContext.stateMachineToIndex
                )
            )
        }
        return
    }

    for (const rootTransition of metTransitions) {
        if (rootTransition.toState === null) {
            continue
        }
        stepContext.reachableTransitions.add(rootTransition.id)
        const preFireRootState = stepContext.vector[stepContext.rootIndex]
        const jointVector = [...stepContext.vector]
        jointVector[stepContext.rootIndex] = rootTransition.toState

        applyReactors(
            stepContext.rootStateMachineName,
            rootTransition.toState,
            preFireRootState,
            stepContext.vector,
            jointVector,
            stepContext.stateMachines,
            stepContext.stateMachineToIndex,
            stepContext.stateTriggerIndex,
            stepContext.reachableTransitions,
            stepContext.unhandledTriggers
        )

        const newKey = jointVector.join("|")
        if (!stepContext.visited.has(newKey)) {
            stepContext.visited.add(newKey)
            stepContext.reachableGlobalStates.push(jointVector)
            stepContext.queue.push(jointVector)
        }
    }
}

/**
 * Performs breadth-first search state-space exploration across all state machines.
 *
 * @param stateMachines Array of state machines in index order.
 * @param normalizedTransitions Classified transitions.
 * @param options Options including `maxStates` limit and `externalOnly` flag.
 * @returns Exploration results with reachability data and unhandled triggers.
 */
export function exploreStateSpace(
    stateMachines: StateMachine[],
    normalizedTransitions: NormalizedTransition[],
    options: { maxStates?: number; externalOnly?: boolean }
): ExplorationResult {
    const { maxStates = 100000, externalOnly = false } = options
    const stateMachineToIndex = new Map(
        stateMachines.map((stateMachine, index) => [stateMachine.name, index])
    )
    const byStateMachine = new Map(
        stateMachines.map(stateMachine => [
            stateMachine.name,
            normalizedTransitions.filter(
                transition => transition.stateMachineName === stateMachine.name
            ),
        ])
    )
    const stateTriggerIndex = buildStateTriggerIndex(normalizedTransitions)

    const initialVector = stateMachines.map(stateMachine => stateMachine.initialState ?? "")
    const queue: string[][] = [initialVector]
    const visited = new Set([initialVector.join("|")])
    const reachableTransitions = new Set<string>()
    const reachableGlobalStates = [initialVector]
    const unhandledTriggers: UnhandledTriggerEntry[] = []
    let truncated = false

    while (queue.length > 0) {
        if (visited.size >= maxStates) {
            truncated = true
            break
        }
        const vector = queue.shift()
        if (!vector) {
            continue
        }

        for (let rootIndex = 0; rootIndex < stateMachines.length; rootIndex++) {
            const rootStateMachineName = stateMachines[rootIndex].name
            const eventCandidates = (byStateMachine.get(rootStateMachineName) ?? []).filter(
                transition =>
                    transition.fromState === vector[rootIndex] &&
                    isEventTrigger(transition.trigger)
            )

            const groupedCandidates = groupCandidatesByTrigger(eventCandidates)
            for (const group of groupedCandidates.values()) {
                if (externalOnly) {
                    continue
                }
                processCandidateGroup(group, {
                    vector,
                    rootIndex,
                    rootStateMachineName,
                    stateMachines,
                    stateMachineToIndex,
                    stateTriggerIndex,
                    reachableTransitions,
                    reachableGlobalStates,
                    unhandledTriggers,
                    visited,
                    queue,
                })
            }
        }
    }

    return {
        reachableTransitions,
        reachableGlobalStates,
        unhandledTriggers,
        truncated,
    }
}
