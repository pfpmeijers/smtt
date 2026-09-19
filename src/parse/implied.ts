/**
 * Implied states: states of other state machines that hold whenever a state does.
 *
 * A state declares them as sub-bullets holding a bare state name. Like an implied condition they
 * are a property of the state itself, so every transition naming the state as a precondition also
 * has them as preconditions — binding, and resolved transitively, so a profile state implying an
 * authenticated state that in turn implies a present session carries all three.
 *
 * Resolution is structural, like state ownership: it reads state declarations only.
 */

import { buildStateOwnership, ownerOfStateName, type StateOwnershipIndex } from "./ownership"
import type { ImpliedState, StateMachine, StateRef, Transition } from "./sm.ast.d"

/** Maps a lower cased state name to the names of the states it directly implies (REQ-456). */
export type ImpliedStatesIndex = Record<string, string[]>

/**
 * Build the implied states index over all state machines, keeping the first declaration.
 *
 * @param stateMachines State machines to index.
 * @returns The directly implied state names keyed by lower-cased state name.
 */
export function buildImpliedStatesIndex(stateMachines: StateMachine[]): ImpliedStatesIndex {
    const index: ImpliedStatesIndex = {}
    for (const stateMachine of stateMachines) {
        for (const state of stateMachine.states) {
            if (!state.impliedStates?.length) continue
            const key = state.name.toLowerCase()
            if (!(key in index)) index[key] = state.impliedStates
        }
    }
    return index
}

/**
 * Every state a state implies, directly or through other implied states, foundation first: a
 * state is listed after the states it implies itself, so the list reads in the order the states
 * are established (a present session, then an authenticated user, then a profile). A state is
 * never listed twice, and never lists the state the closure starts from.
 *
 * @param stateName State to resolve.
 * @param index Implied states index.
 * @returns The implied state names, each after the states it implies.
 */
export function impliedStateClosure(stateName: string, index: ImpliedStatesIndex): string[] {
    const closure: string[] = []
    const seen = new Set<string>([stateName.toLowerCase()])
    const visit = (name: string): void => {
        for (const implied of index[name] ?? []) {
            const key = implied.toLowerCase()
            if (seen.has(key)) continue
            seen.add(key)
            visit(key)
            closure.push(key)
        }
    }
    visit(stateName.toLowerCase())
    return closure
}

/**
 * The states a transition carries beyond its own: those implied, transitively, by the states it
 * names. A state whose machine the transition already names — or an earlier implied state already
 * names — is left out: the transition's own state stands for that machine. Validation reports the
 * contradictory case, where the two differ.
 *
 * @param transition Transition to resolve.
 * @param index Implied states index.
 * @param ownership State ownership index.
 * @returns The implied states, each with the transition state implying it, foundation first per
 *   implying state (see `impliedStateClosure`).
 */
export function impliedStatesOfTransition(
    transition: Transition,
    index: ImpliedStatesIndex,
    ownership: StateOwnershipIndex,
): ImpliedState[] {
    const represented = new Set<string>()
    for (const stateRef of transition.states ?? []) {
        const owner = ownerOfStateName(stateRef.name, ownership)
        if (owner) represented.add(owner)
    }

    const implied: ImpliedState[] = []
    for (const stateRef of transition.states ?? []) {
        for (const name of impliedStateClosure(stateRef.name, index)) {
            const owner = ownerOfStateName(name, ownership)
            if (!owner || represented.has(owner)) continue
            represented.add(owner)
            implied.push({ name, by: stateRef.name.toLowerCase() })
        }
    }
    return implied
}

/**
 * A transition's states with the states they imply put in place: each state is preceded by the
 * states it implies, foundation first, so the list reads in the order the states are established.
 * An implied state whose implying state is not among `states` — one a consumer dropped — comes
 * first.
 *
 * @param states The transition's own precondition states, in order.
 * @param implied The transition's implied states, as recorded by `annotateImpliedStates`.
 * @returns The states with their implied states interleaved.
 */
export function withImpliedStates(states: StateRef[], implied: ImpliedState[] = []): StateRef[] {
    const names = new Set(states.map((stateRef) => stateRef.name.toLowerCase()))
    const orphans = implied.filter((entry) => !names.has(entry.by))
    return [
        ...orphans.map(({ name }) => ({ name })),
        ...states.flatMap((stateRef) => [
            ...implied.filter((entry) => entry.by === stateRef.name.toLowerCase()).map(({ name }) => ({ name })),
            stateRef,
        ]),
    ]
}

/**
 * Annotates every transition with the states its own states imply (REQ-456), in place.
 *
 * The annotation is derived data, like an expansion annotation: a consumer reads it instead of
 * resolving implied states itself. A transition implying nothing carries no annotation.
 *
 * @param stateMachines State machines to annotate (mutated in place).
 */
export function annotateImpliedStates(stateMachines: StateMachine[]): void {
    const index = buildImpliedStatesIndex(stateMachines)
    const ownership = buildStateOwnership(stateMachines)
    for (const stateMachine of stateMachines) {
        for (const transition of stateMachine.transitions ?? []) {
            const implied = impliedStatesOfTransition(transition, index, ownership)
            if (implied.length > 0) transition.impliedStates = implied
            else delete transition.impliedStates
        }
    }
}
