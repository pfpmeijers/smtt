import type { DefaultPrecondition, StateMachine, StateOwnershipIndex, StateRef, Transition } from "../parse"
import {
    conflictsWithAnyState,
    defaultPreconditionToStateRef,
    impliedInitialStateRefs,
    preconditionGroups,
    semanticArgumentsSignature,
    unrepresentedDefaultPreconditions,
    withImpliedStates,
} from "../parse"

// Re-exported so consumers keep one import site for building `Given` steps.
export { defaultPreconditionToStateRef, impliedInitialStateRefs, unrepresentedDefaultPreconditions }

// --- De-duplication ---

/**
 * Semantic content of a state reference's arguments (REQ-116) — two references naming the same
 * attribute with the same modifier/condition are the same reference even when authored with
 * different qualifier wording (e.g. `of` vs `under`).
 *
 * @param stateRef State reference to identify.
 * @returns A stable signature for the state reference's arguments.
 */
function stateRefArgumentsKey(stateRef: StateRef): string {
    return semanticArgumentsSignature(stateRef.arguments)
}

/**
 * Whether a state reference carries no arguments at all — a plain name with no attached data,
 * as opposed to one that names an attribute (with or without a condition/modifier).
 *
 * @param stateRef State reference to inspect.
 * @returns Whether the reference is argument-free.
 */
function isBareStateRef(stateRef: StateRef): boolean {
    return (stateRef.arguments ?? []).length === 0
}

/**
 * Merge state references that name the same state (REQ-116), keeping each name's first-seen
 * position but resolving repeated occurrences by content:
 * - Identical arguments (REQ-116's "same name and same arguments"): a plain duplicate, dropped.
 * - One bare, the other carrying arguments: the bare reference carries no information about that
 *   state beyond its name, so it cannot contradict a more specific reference for the same name —
 *   the specific one is kept (regardless of which was seen first), typically the case when an
 *   expansion source injects a generic precondition alongside a transition's own more specific one
 *   for the same underlying state (e.g. a bare `painting in cart` injected next to the transition's
 *   own `painting in cart of "<email address>"`).
 * - Both carrying different arguments: genuinely incompatible claims about the same state at the
 *   same time, which REQ-116 calls out as invalid ("it is invalid for references to share the same
 *   state name but carry different arguments") — raised as an error rather than silently picking
 *   one, since silently dropping either side would hide a real modeling contradiction.
 *
 * @param stateRefs State references to merge, in effective step order.
 * @param transitionId Optional transition ID for error context.
 * @returns One state reference per distinct name, in first-seen order.
 * @throws Error When two non-bare references for the same state name carry different arguments.
 */
function dedupeStateRefs(stateRefs: StateRef[], transitionId?: string): StateRef[] {
    const byName = new Map<string, StateRef>()
    for (const stateRef of stateRefs) {
        const nameKey = stateRef.name.toLowerCase()
        const existing = byName.get(nameKey)
        if (existing === undefined) {
            byName.set(nameKey, stateRef)
            continue
        }
        if (stateRefArgumentsKey(existing) === stateRefArgumentsKey(stateRef)) continue
        if (isBareStateRef(existing)) {
            byName.set(nameKey, stateRef)
            continue
        }
        if (isBareStateRef(stateRef)) continue
        const transitionContext = transitionId ? ` transition ${transitionId}` : ''
        throw new Error(
            `Conflicting precondition references for state \`${stateRef.name}\` in${transitionContext}: ` +
                `both \`${stateRefArgumentsKey(existing)}\` and \`${stateRefArgumentsKey(stateRef)}\` ` +
                `are required as preconditions of the same transition.`,
        )
    }
    return [...byName.values()]
}


/**
 * Whether a transition's own precondition state names a different state than an expansion
 * source has already injected for the same owning state machine (REQ-114) — e.g. the transition's
 * own state requires a machine's state directly, while a state-trigger expansion source establishes
 * that same machine's *initial* state and reaches the required one only as an intermediate result
 * partway through the chain.
 *
 * @param ownState Transition's own precondition state to check.
 * @param injectedStates States injected by the expansion path.
 * @param ownership State ownership index.
 * @returns Whether `ownState` conflicts with an injected state of the same owning state machine.
 */
function conflictsWithInjectedState(
    ownState: StateRef,
    injectedStates: StateRef[],
    ownership: StateOwnershipIndex,
): boolean {
    return conflictsWithAnyState(ownState, injectedStates, ownership)
}

/**
 * Ordered list of effective `Given` state references of a transition (REQ-035/REQ-115):
 * the state machine's own default preconditions first (in their declared array order — these
 * typically name states of *other*, dependent state machines, not of `stateMachine` itself),
 * then the implied initial state (a synthetic fallback used only when nothing else already
 * represents the owning machine), then the transition's own explicit states (in their declared
 * array order), then the states injected by expansion sources.
 *
 * A default precondition is only injected when no other effective state belongs to the same
 * owning state machine (REQ-036) — so restating that machine's state explicitly, anywhere in the
 * transition's own declared states, both substitutes for the default (or the implied initial
 * state) and repositions it into the transition's own explicit-states group, letting a single
 * transition force a custom precondition order for itself. Duplicate references are removed,
 * keeping the first occurrence (REQ-116) — so a later-listed state (e.g. one injected by
 * expansion) that repeats a name already present among the earlier groups is dropped, leaving
 * the earlier reference's position in place.
 *
 * A transition's own explicit state is dropped when it conflicts with a state already injected
 * by the expansion path for the same owning state machine (REQ-114): the injected state reflects
 * that machine's actual starting state along the causal chain the scenario walks through, so a
 * differently named own precondition for the same machine would otherwise assert a contradictory
 * starting state (e.g. a machine required present while the chain that reaches the trigger starts
 * from that machine being absent). This conflict check is independent of display order — it
 * exists for causal correctness, not to decide which reference is shown first.
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
    const declaredStates = transition.states ?? []
    const transitionStates = declaredStates.filter(
        (stateRef) => !conflictsWithInjectedState(stateRef, injectedStates, ownership),
    )
    // The implied-initial-state fallback is decided against the transition's originally declared
    // states, not the conflict-filtered ones: a declared own precondition dropped above for
    // conflicting with the expansion path still counts as "already has an own precondition state"
    // (REQ-132) — otherwise the fallback would blindly re-add that very state by name.
    const impliedInitialStates = impliedInitialStateRefs(declaredStates, defaultPreconditions, stateMachine, ownership)

    // Only the top-level transition's own states (implied or explicit) may suppress/reposition a
    // default precondition (REQ-036) — an expansion-injected state must not, since defaults belong
    // in the first group regardless of expansion (REQ-115); a later duplicate contributed by
    // expansion is instead dropped by de-duplication below (REQ-116), leaving the default in place.
    // A default binds (REQ-455): an expansion path whose starting state contradicts it never
    // reaches this point, because `expandStateTrigger` prunes it. The states the transition's own
    // states imply (REQ-458) each precede the state implying them, foundation first — except one
    // standing in for a default of its own machine, which takes the default's place in the first group.
    const { leading, implied } = preconditionGroups(transition, defaultPreconditions, stateMachine, ownership)

    return dedupeStateRefs(
        [...leading, ...impliedInitialStates, ...withImpliedStates(transitionStates, implied), ...injectedStates],
        transition.id,
    )
}

