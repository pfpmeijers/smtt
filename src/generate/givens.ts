import type { DefaultPrecondition, StateMachine, StateRef, Transition } from "../parse"
import { semanticArgumentsSignature } from "./arguments"
import { ownerOfStateName, ownerOfStateRef, type StateOwnershipIndex } from "./ownership"

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
 * Default preconditions whose owning state machine is not already pinned down by one of
 * `representedStates` (REQ-036): a default precondition only fills in a state machine that
 * nothing else already speaks for. Applying this consistently wherever default preconditions are
 * injected prevents a default from contradicting a state already established for the same state
 * machine by other means (e.g. an explicit state on a state-trigger expansion source).
 *
 * @param defaultPreconditions Default preconditions to filter.
 * @param representedStates States that already pin down their owning state machines.
 * @param ownership State ownership index.
 * @returns The default preconditions not already represented.
 */
export function unrepresentedDefaultPreconditions(
    defaultPreconditions: DefaultPrecondition[],
    representedStates: StateRef[],
    ownership: StateOwnershipIndex,
): DefaultPrecondition[] {
    const representedStateMachines = new Set<string>()
    for (const stateRef of representedStates) {
        const owner = ownerOfStateRef(stateRef, ownership)
        if (owner) representedStateMachines.add(owner)
    }
    return defaultPreconditions.filter((precondition) => {
        const owner = ownerOfStateName(precondition.state, ownership)
        return !(owner && representedStateMachines.has(owner))
    })
}

/**
 * Whether a transition's own precondition state names a different state than an expansion
 * source has already injected for the same owning state machine — e.g. the transition's own
 * state requires a machine's state directly, while a state-trigger expansion source establishes
 * that same machine's *initial* state and reaches the required one only as an intermediate
 * result partway through the chain. Same-name state references (regardless of arguments) are not
 * a conflict: a more specific reference (e.g. carrying an attribute) alongside a plainer injected
 * one for the same state is additional detail, not a contradiction.
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
    const owner = ownerOfStateRef(ownState, ownership)
    if (!owner) return false
    return injectedStates.some((injected) =>
        ownerOfStateRef(injected, ownership) === owner
        && injected.name.toLowerCase() !== ownState.name.toLowerCase(),
    )
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
    const impliedStates = impliedInitialStateRefs(declaredStates, defaultPreconditions, stateMachine, ownership)
    const ownStates = [...impliedStates, ...transitionStates]

    // Only the top-level transition's own states (implied or explicit) may suppress/reposition a
    // default precondition (REQ-036) — an expansion-injected state must not, since defaults belong
    // in the first group regardless of expansion (REQ-115); a later duplicate contributed by
    // expansion is instead dropped by de-duplication below (REQ-116), leaving the default in place.
    const injectedDefaults = unrepresentedDefaultPreconditions(defaultPreconditions, ownStates, ownership)
        .map(defaultPreconditionToStateRef)

    return dedupeStateRefs([...injectedDefaults, ...ownStates, ...injectedStates], transition.id)
}

