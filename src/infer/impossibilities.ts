/**
 * Closed-world inference of impossible trigger/state combinations.
 * Derives impossibilities from the set of handled transitions in the parsed AST
 * without building the full Cartesian product.
 */

import type { StateMachine, ImpossibleTrigger, Trigger } from "../parse"

type DeclaredCoverageEntry = {
    states: Set<string>
    trigger: string
}

type ExternalAssignmentByMachine = Record<string, string>

/**
 * Builds global lookup tables for state ownership and canonical state names.
 *
 * @param stateMachines Parsed state machines.
 * @returns Lookup tables keyed by lowercase state name.
 */
function buildStateOwnershipIndexes(stateMachines: StateMachine[]): {
    stateToMachine: Map<string, string>
    canonicalStateNames: Map<string, string>
} {
    const stateToMachine = new Map<string, string>()
    const canonicalStateNames = new Map<string, string>()

    for (const stateMachine of stateMachines) {
        for (const state of stateMachine.states ?? []) {
            const lowerStateName = state.name.toLowerCase()
            stateToMachine.set(lowerStateName, stateMachine.name)
            canonicalStateNames.set(lowerStateName, state.name)
        }
    }

    return { stateToMachine, canonicalStateNames }
}

/**
 * Builds the trigger vocabulary for one state machine.
 *
 * @param stateMachine Current state machine under analysis.
 * @param stateToMachine Global state-to-machine ownership index.
 * @returns Map of trigger name to canonical trigger object.
 */
function buildTriggerVocabulary(
    stateMachine: StateMachine,
    stateToMachine: Map<string, string>
): Map<string, Trigger> {
    const triggerMap = new Map<string, Trigger>()

    for (const transition of stateMachine.transitions ?? []) {
        const trigger = transition.trigger
        if (trigger.type === "state") {
            const ownerMachine = stateToMachine.get(trigger.name.toLowerCase())
            if (ownerMachine && ownerMachine !== stateMachine.name) {
                continue
            }
        }
        if (!triggerMap.has(trigger.name)) {
            triggerMap.set(trigger.name, trigger)
        }
    }

    return triggerMap
}

/**
 * Builds external-machine state options referenced by one state machine.
 *
 * @param stateMachine Current state machine under analysis.
 * @param stateMachines All parsed state machines.
 * @param ownStateNames Lowercased state names owned by `stateMachine`.
 * @param stateToMachine Global state-to-machine ownership index.
 * @returns Map of external machine name to all of its possible states.
 */
function buildExternalMachineStates(
    stateMachine: StateMachine,
    stateMachines: StateMachine[],
    ownStateNames: Set<string>,
    stateToMachine: Map<string, string>
): Map<string, string[]> {
    const externalMachineStates = new Map<string, string[]>()

    for (const transition of stateMachine.transitions ?? []) {
        for (const stateReference of transition.states ?? []) {
            const lowerStateName = stateReference.name.toLowerCase()
            if (ownStateNames.has(lowerStateName)) {
                continue
            }
            const ownerMachine = stateToMachine.get(lowerStateName)
            if (!ownerMachine || ownerMachine === stateMachine.name) {
                continue
            }
            if (externalMachineStates.has(ownerMachine)) {
                continue
            }
            const ownerMachineObject = stateMachines.find(machine => machine.name === ownerMachine)
            externalMachineStates.set(ownerMachine, (ownerMachineObject?.states ?? []).map(state => state.name))
        }
    }

    return externalMachineStates
}

/**
 * Builds declared impossibility entries used for coverage checks.
 *
 * @param stateMachine Current state machine under analysis.
 * @returns Normalized declared impossibilities for subset checks.
 */
function buildDeclaredCoverageEntries(stateMachine: StateMachine): DeclaredCoverageEntry[] {
    return (stateMachine.impossible?.defined ?? []).map(declared => ({
        states: new Set(declared.states.map(state => state.toLowerCase())),
        trigger: declared.trigger.name.toLowerCase(),
    }))
}

/**
 * Creates a coverage checker against declared and inferred entries.
 *
 * @param declaredCoverageEntries Normalized declared impossibility entries.
 * @param inferredForMachine Mutable inferred impossibilities collected so far.
 * @returns Predicate that reports whether a candidate entry is already covered.
 */
function createCoverageChecker(
    declaredCoverageEntries: DeclaredCoverageEntry[],
    inferredForMachine: ImpossibleTrigger[]
): (stateArray: string[], triggerText: string) => boolean {
    return (stateArray: string[], triggerText: string): boolean => {
        const lowerStates = new Set(stateArray.map(state => state.toLowerCase()))
        const lowerTrigger = triggerText.toLowerCase()

        const isSubsumed = (candidateEntry: DeclaredCoverageEntry): boolean =>
            candidateEntry.trigger === lowerTrigger &&
            [...candidateEntry.states].every(state => lowerStates.has(state))

        if (declaredCoverageEntries.some(isSubsumed)) {
            return true
        }

        return inferredForMachine.some(entry => {
            const candidateEntry: DeclaredCoverageEntry = {
                trigger: entry.trigger.name.toLowerCase(),
                states: new Set(entry.states.map(state => state.toLowerCase())),
            }
            return isSubsumed(candidateEntry)
        })
    }
}

/**
 * Collects handled external assignments per own state for one trigger.
 *
 * @param stateMachine Current state machine under analysis.
 * @param triggerName Trigger currently being inferred.
 * @param ownStateNames Lowercased state names owned by `stateMachine`.
 * @param stateToMachine Global state-to-machine ownership index.
 * @param canonicalStateNames Lowercased state name to canonical-cased state name.
 * @returns Map from own state to external assignments seen in handled transitions.
 */
function collectHandledByOwnState(
    stateMachine: StateMachine,
    triggerName: string,
    ownStateNames: Set<string>,
    stateToMachine: Map<string, string>,
    canonicalStateNames: Map<string, string>
): Map<string, ExternalAssignmentByMachine[]> {
    const handledByOwnState = new Map<string, ExternalAssignmentByMachine[]>()
    for (const ownState of stateMachine.states) {
        handledByOwnState.set(ownState.name, [])
    }

    for (const transition of stateMachine.transitions ?? []) {
        if (transition.trigger.name !== triggerName) {
            continue
        }

        const ownStateReference = (transition.states ?? []).find(stateReference =>
            ownStateNames.has(stateReference.name.toLowerCase())
        )
        if (!ownStateReference) {
            continue
        }

        const canonicalOwnState =
            canonicalStateNames.get(ownStateReference.name.toLowerCase()) ?? ownStateReference.name

        const externalAssignment: ExternalAssignmentByMachine = {}
        for (const stateReference of transition.states ?? []) {
            const lowerStateName = stateReference.name.toLowerCase()
            if (ownStateNames.has(lowerStateName)) {
                continue
            }
            const ownerMachine = stateToMachine.get(lowerStateName)
            if (ownerMachine && ownerMachine !== stateMachine.name) {
                externalAssignment[ownerMachine] =
                    canonicalStateNames.get(lowerStateName) ?? stateReference.name
            }
        }

        handledByOwnState.get(canonicalOwnState)?.push(externalAssignment)
    }

    return handledByOwnState
}

/**
 * Emits universally impossible external-state values for one trigger.
 *
 * @param externalMachineList External machine/state options for the current machine.
 * @param handledByOwnState Handled assignments grouped by own state.
 * @param emit Callback that records one inferred impossibility.
 * @returns Lowercased external-state values already emitted as universal impossibilities.
 */
function emitUniversalExternalStateValues(
    externalMachineList: [string, string[]][],
    handledByOwnState: Map<string, ExternalAssignmentByMachine[]>,
    emit: (stateArray: string[]) => void
): Set<string> {
    const universallyImpossibleExternalStateValues = new Set<string>()

    for (const [externalMachineName, externalStates] of externalMachineList) {
        for (const externalState of externalStates) {
            const appearsAnywhere = [...handledByOwnState.values()].some(handledAssignments =>
                handledAssignments.some(assignment => assignment[externalMachineName] === externalState)
            )
            if (!appearsAnywhere) {
                universallyImpossibleExternalStateValues.add(externalState.toLowerCase())
                emit([externalState])
            }
        }
    }

    return universallyImpossibleExternalStateValues
}

/**
 * Emits per-own-state impossibilities not covered by the universal phase.
 *
 * @param externalMachineList External machine/state options for the current machine.
 * @param handledByOwnState Handled assignments grouped by own state.
 * @param universallyImpossibleExternalStateValues Phase-1 universal external states.
 * @param emit Callback that records one inferred impossibility.
 */
function emitPerOwnStateImpossibilities(
    externalMachineList: [string, string[]][],
    handledByOwnState: Map<string, ExternalAssignmentByMachine[]>,
    universallyImpossibleExternalStateValues: Set<string>,
    emit: (stateArray: string[]) => void
): void {
    for (const [ownState, handledAssignments] of handledByOwnState) {
        if (handledAssignments.length === 0) {
            emit([ownState])
            continue
        }

        for (const [externalMachineName, externalStates] of externalMachineList) {
            const handledValuesForOwnState = new Set(
                handledAssignments
                    .map(assignment => assignment[externalMachineName])
                    .filter(Boolean)
            )

            for (const externalState of externalStates) {
                if (!handledValuesForOwnState.has(externalState) &&
                    !universallyImpossibleExternalStateValues.has(externalState.toLowerCase())) {
                    emit([externalState, ownState])
                }
            }
        }
    }
}

/**
 * Infers impossibilities for one state machine and trigger set.
 *
 * @param stateMachine Current state machine under analysis.
 * @param stateMachines All parsed state machines.
 * @param stateToMachine Global state-to-machine ownership index.
 * @param canonicalStateNames Lowercased state name to canonical-cased state name.
 * @returns Inferred impossibilities for the provided state machine.
 */
function inferForStateMachine(
    stateMachine: StateMachine,
    stateMachines: StateMachine[],
    stateToMachine: Map<string, string>,
    canonicalStateNames: Map<string, string>
): ImpossibleTrigger[] {
    const inferredForMachine: ImpossibleTrigger[] = []
    const ownStateNames = new Set(stateMachine.states.map(state => state.name.toLowerCase()))
    const triggerMap = buildTriggerVocabulary(stateMachine, stateToMachine)
    if (!triggerMap.size) {
        return inferredForMachine
    }

    const externalMachineStates = buildExternalMachineStates(
        stateMachine,
        stateMachines,
        ownStateNames,
        stateToMachine
    )
    const externalMachineList = [...externalMachineStates.entries()]
    const declaredCoverageEntries = buildDeclaredCoverageEntries(stateMachine)
    const isCovered = createCoverageChecker(declaredCoverageEntries, inferredForMachine)

    for (const [triggerName, triggerObject] of triggerMap) {
        const emit = (stateArray: string[]): void => {
            if (!isCovered(stateArray, triggerObject.name)) {
                inferredForMachine.push({
                    states: stateArray,
                    trigger: { type: triggerObject.type, name: triggerObject.name },
                })
            }
        }

        const handledByOwnState = collectHandledByOwnState(
            stateMachine,
            triggerName,
            ownStateNames,
            stateToMachine,
            canonicalStateNames
        )

        const universallyImpossibleExternalStateValues = emitUniversalExternalStateValues(
            externalMachineList,
            handledByOwnState,
            emit
        )

        emitPerOwnStateImpossibilities(
            externalMachineList,
            handledByOwnState,
            universallyImpossibleExternalStateValues,
            emit
        )
    }

    return inferredForMachine
}

/**
 * Computes inferred impossible `{ states, trigger }` entries for every state machine
 * using the closed-world assumption, without building the full Cartesian product first.
 *
 * For each trigger the algorithm works in two phases:
 *   1. **Universal phase** — for each external state machine's state value, check whether it
 *      appears in any handled assignment across ALL own states. If it never appears,
 *      the impossibility is orthogonal to the own-state dimension: emit
 *      `{states:[externalStateValue]}`.
 *   2. **Per-own-state phase** — for each own state `fromState`:
 *      - If no handled assignment exists for `fromState` at all: `fromState` alone
 *        is universally impossible for that trigger → emit `{states:[fromState]}`.
 *      - Otherwise, for each external state machine, find external-state values missing from
 *        the handled assignments for `fromState`. Emit
 *        `{states:[externalStateValue, fromState]}` only when
 *        `externalStateValue` was not already emitted as universal in phase 1.
 *
 * Coverage is checked inline before each emit so that a more specific entry is never
 * added when a simpler one already covers it (declared OR previously inferred).
 *
 * Trigger vocabulary excludes state-triggers whose state belongs to another machine,
 * since those represent reactive cross-machine dependencies, not own triggers.
 *
 * @param stateMachines Parsed AST array from `state-machines.json`.
 * @returns Map from state machine name to inferred `ImpossibleTrigger` list.
 */
export function computeInferredImpossibilities(
    stateMachines: StateMachine[]
): Record<string, ImpossibleTrigger[]> {
    const { stateToMachine, canonicalStateNames } = buildStateOwnershipIndexes(stateMachines)

    const result: Record<string, ImpossibleTrigger[]> = {}

    for (const stateMachine of stateMachines) {
        result[stateMachine.name] = inferForStateMachine(
            stateMachine,
            stateMachines,
            stateToMachine,
            canonicalStateNames
        )
    }

    return result
}
