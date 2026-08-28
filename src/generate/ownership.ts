import type { ImpliedCondition, StateMachine, StateRef } from "../parse"

// --- State ownership ---

/** Maps a lower cased state name to the name of the state machine declaring it (REQ-150). */
export type StateOwnershipIndex = Record<string, string>

/** Marker owner for a state name declared by more than one state machine (REQ-154). */
const AMBIGUOUS_OWNER = "__AMBIGUOUS_OWNER__"

/**
 * Build the state ownership index over all state machines. State names declared by multiple
 * machines are marked as ambiguous rather than resolved (REQ-154).
 *
 * @param stateMachines State machines to index.
 * @returns The ownership index keyed by lower-cased state name.
 */
export function buildStateOwnership(stateMachines: StateMachine[]): StateOwnershipIndex {
    const ownership: StateOwnershipIndex = {}
    for (const stateMachine of stateMachines) {
        for (const state of stateMachine.states) {
            const key = state.name.toLowerCase()
            if (!(key in ownership)) {
                ownership[key] = stateMachine.name
            } else if (ownership[key] !== stateMachine.name) {
                ownership[key] = AMBIGUOUS_OWNER
            }
        }
    }
    return ownership
}

/**
 * All state names that are declared by more than one state machine (REQ-154).
 *
 * @param ownership State ownership index to inspect.
 * @returns The lower-cased state names that are ambiguous.
 */
export function ambiguousStateNames(ownership: StateOwnershipIndex): string[] {
    return Object.entries(ownership)
        .filter(([, owner]) => owner === AMBIGUOUS_OWNER)
        .map(([stateName]) => stateName)
}

/**
 * Resolve the state machine owning a state name.
 *
 * @returns The owning state machine name, or `undefined` for an unmodeled/foreign state name.
 * @throws Error When the state name is declared by multiple state machines (REQ-154).
 */
export function ownerOfStateName(stateName: string, ownership: StateOwnershipIndex): string | undefined {
    const owner = ownership[stateName.toLowerCase()]
    if (owner === AMBIGUOUS_OWNER) {
        throw new Error(
            `Ambiguous state name lookup "${stateName}": the same state name appears in multiple state machines (REQ-154).`,
        )
    }
    return owner
}

/**
 * Resolve the state machine owning the state referenced by a state references.
 *
 * @param stateRef State references to resolve.
 * @param ownership State ownership index.
 * @returns The owning state machine name, or `undefined` when the state is unmodeled.
 */
export function ownerOfStateRef(stateRef: StateRef, ownership: StateOwnershipIndex): string | undefined {
    return ownerOfStateName(stateRef.name, ownership)
}

// --- Implied conditions ---

/**
 * Maps a lower cased state name to the implied conditions declared on its state definition.
 * Implied conditions filter example rows whenever the state is a precondition of a
 * transition (REQ-148/REQ-165).
 */
export type ImpliedConditionsIndex = Record<string, ImpliedCondition[]>

/**
 * Build the implied conditions index over all state machines, keeping the first declaration.
 *
 * @param stateMachines State machines to index.
 * @returns The implied-condition index keyed by lower-cased state name.
 */
export function buildImpliedConditionsIndex(stateMachines: StateMachine[]): ImpliedConditionsIndex {
    const index: ImpliedConditionsIndex = {}
    for (const stateMachine of stateMachines) {
        for (const state of stateMachine.states) {
            if (!state.impliedConditions?.length) continue
            const key = state.name.toLowerCase()
            if (!(key in index)) index[key] = state.impliedConditions
        }
    }
    return index
}

