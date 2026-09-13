import type { DefaultPrecondition, StateMachine, StateOwnershipIndex, StateRef, Transition } from "../parse"
import {
    collectImpliedFilterConditionsForGivens,
    type FilterCondition,
    type ImpliedConditionsIndex,
} from "../parse"
import { buildEffectiveGivens } from "./givens"

/**
 * Row filters contributed by the implied conditions of a transition's effective `Given` states
 * — explicit transition states, injected default preconditions and the implied initial state
 * (REQ-148/REQ-165/REQ-167).
 *
 * @param stateMachine State machine owning the transition.
 * @param transition Transition to collect the implied conditions for.
 * @param defaultPreconditions Default preconditions of the owning state machine.
 * @param ownership State ownership index.
 * @param impliedIndex Implied conditions declared per state.
 * @param availableAttributes Attribute names present in the effective examples table; implied
 *   conditions on any other attribute impose no filter (REQ-166).
 * @param injectedGivenStates States injected by the transition's own expansion path, if any.
 * @returns Filter conditions contributed by implied state conditions.
 */
export function collectImpliedFilterConditions(
    stateMachine: StateMachine,
    transition: Transition,
    defaultPreconditions: DefaultPrecondition[],
    ownership: StateOwnershipIndex,
    impliedIndex: ImpliedConditionsIndex,
    availableAttributes: ReadonlySet<string>,
    injectedGivenStates: StateRef[] = [],
): FilterCondition[] {
    const givens = buildEffectiveGivens(transition, defaultPreconditions, ownership, stateMachine, injectedGivenStates)
    return collectImpliedFilterConditionsForGivens(stateMachine.name, givens, impliedIndex, availableAttributes)
}
