import type { DefaultPrecondition, StateMachine, StateRef, Transition } from "../parse"
import { argumentsSignature } from "./arguments"
import { ownerOfStateName, ownerOfStateRef, type StateOwnershipIndex } from "./ownership"

// --- De-duplication ---

/**
 * Identity of a state references: its state name plus its arguments (REQ-116).
 *
 * @param stateRef State references to identify.
 * @returns A stable key for the state references.
 */
function stateRefKey(stateRef: StateRef): string {
    return `${stateRef.name.toLowerCase()}|${argumentsSignature(stateRef.arguments)}`
}

/**
 * Remove state references that repeat an earlier name/arguments combination (REQ-116).
 *
 * @param stateRefs State references to deduplicate.
 * @returns State references with repeated name/argument combinations removed.
 */
function dedupeStateRefs(stateRefs: StateRef[]): StateRef[] {
    const seen = new Set<string>()
    return stateRefs.filter((stateRef) => {
        const key = stateRefKey(stateRef)
        if (seen.has(key)) return false
        seen.add(key)
        return true
    })
}

// --- Implied initial state ---

/**
 * Effective initial state name of a state machine: its declared `initialState`, falling back
 * to the first declared state when not set (REQ-133/REQ-134).
 *
 * @param stateMachine State machine to inspect.
 * @returns The initial state name, or `undefined` when the state machine declares no states.
 */
function initialStateName(stateMachine: StateMachine): string | undefined {
    return stateMachine.initialState ?? stateMachine.states[0]?.name
}

/**
 * Whether a transition already has a precondition state within its own state machine's state
 * space — either through its explicit states, or through a default precondition naming a state
 * owned by that same state machine (REQ-036/REQ-132).
 *
 * Default preconditions naming a state of another state machine (or an unmodeled/foreign label) do
 * not count: they do not populate the state machine's own state space, so they must not suppress the
 * implied initial state fallback.
 *
 * @param transitionStates Explicit states of the transition.
 * @param defaultPreconditions Default preconditions of the transition's state machine.
 * @param stateMachine State machine that owns the transition.
 * @param ownership State ownership index.
 * @returns Whether an own state machine precondition state is already present.
 */
function hasOwnPreconditionState(
    transitionStates: StateRef[],
    defaultPreconditions: DefaultPrecondition[],
    stateMachine: StateMachine,
    ownership: StateOwnershipIndex,
): boolean {
    const isOwnState = (stateName: string) => ownerOfStateName(stateName, ownership) === stateMachine.name
    return transitionStates.some((stateRef) => isOwnState(stateRef.name))
        || defaultPreconditions.some((precondition) => isOwnState(precondition.state))
}

/**
 * Implied own precondition state of a transition (REQ-132): the state machine's effective initial
 * state, implied whenever the transition has no precondition state within its own state machine's
 * state space.
 *
 * @param transitionStates Explicit states of the transition.
 * @param defaultPreconditions Default preconditions of the transition's state machine.
 * @param stateMachine State machine that owns the transition.
 * @param ownership State ownership index.
 * @returns A single-element list with the implied initial state, or an empty list when an own
 *   precondition state is already present or the state machine declares no states at all.
 */
export function impliedInitialStateRefs(
    transitionStates: StateRef[],
    defaultPreconditions: DefaultPrecondition[],
    stateMachine: StateMachine,
    ownership: StateOwnershipIndex,
): StateRef[] {
    if (hasOwnPreconditionState(transitionStates, defaultPreconditions, stateMachine, ownership)) return []
    const initialState = initialStateName(stateMachine)
    return initialState ? [{ name: initialState }] : []
}

// --- Effective given states ---

/**
 * Convert a default precondition declaration into a state references for a `Given` list.
 *
 * @param precondition Default precondition to convert.
 * @returns The corresponding state references.
 */
export function defaultPreconditionToStateRef(precondition: DefaultPrecondition): StateRef {
    return {
        name: precondition.state,
        ...(precondition.arguments ? { arguments: precondition.arguments } : {}),
    }
}

/**
 * Ordered list of effective `Given` state references of a transition (REQ-035/REQ-115):
 * injected default preconditions first, then the states injected by expansion sources, then
 * the transition's own explicit states, then the implied initial state.
 *
 * A default precondition is only injected when no other effective state belongs to the same
 * owning state machine (REQ-036). Duplicate references are removed, keeping the first
 * occurrence (REQ-116).
 *
 * @param transition Transition to build the `Given` list for.
 * @param defaultPreconditions Default preconditions of the rendering state machine.
 * @param ownership State ownership index.
 * @param stateMachine State machine owning the transition.
 * @param injectedStates States contributed by an expansion path, if any.
 * @returns The ordered effective `Given` state references.
 */
export function buildEffectiveGivens(
    transition: Transition,
    defaultPreconditions: DefaultPrecondition[],
    ownership: StateOwnershipIndex,
    stateMachine: StateMachine,
    injectedStates: StateRef[] = [],
): StateRef[] {
    const transitionStates = transition.states ?? []
    const impliedStates = impliedInitialStateRefs(transitionStates, defaultPreconditions, stateMachine, ownership)
    const combinedStates = [...injectedStates, ...transitionStates, ...impliedStates]

    const representedStateMachines = new Set<string>()
    for (const stateRef of combinedStates) {
        const owner = ownerOfStateRef(stateRef, ownership)
        if (owner) representedStateMachines.add(owner)
    }

    const injectedDefaults = defaultPreconditions
        .filter((precondition) => {
            const owner = ownerOfStateName(precondition.state, ownership)
            return !(owner && representedStateMachines.has(owner))
        })
        .map(defaultPreconditionToStateRef)

    return dedupeStateRefs([...injectedDefaults, ...combinedStates])
}

