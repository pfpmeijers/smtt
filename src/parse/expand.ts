/**
 * State-trigger expansion: which transitions can causally explain a state trigger.
 *
 * Resolution is structural — it reads transitions, their arguments and state ownership, never
 * example values — so it is a property of the parsed model rather than of any consumer. Both the
 * validate step and the feature generator resolve triggers through this module, instead of each
 * keeping its own (necessarily diverging) copy.
 *
 * What a consumer does with a resolved source — which steps it renders, which spelling of a
 * modifier it prints — stays with that consumer.
 */

import { evaluateCondition } from "./conditions"
import { buildStateOwnership, ownerOfStateName, ownerOfStateRef, type StateOwnershipIndex } from "./ownership"
import type {
    Argument, DefaultPrecondition, ExpansionSourceRef, StateMachine, Transition, Trigger,
} from "./sm.ast.d"

/** Guard against runaway recursion through (near-)cyclic expansion chains. */
export const MAX_EXPANSION_DEPTH = 10

// --- Transition index ---

/** A transition paired with the state machine declaring it. */
export interface TaggedTransition {
    stateMachineName: string
    stateMachine: StateMachine
    transition: Transition
}

/**
 * Flatten all state machines into a single list of transitions tagged with their owner.
 *
 * @param stateMachines State machines to index.
 * @returns Tagged transitions across all state machines.
 */
export function buildTaggedTransitions(stateMachines: StateMachine[]): TaggedTransition[] {
    return stateMachines.flatMap((stateMachine) =>
        (stateMachine.transitions ?? []).map((transition) => ({
            stateMachineName: stateMachine.name,
            stateMachine,
            transition,
        })),
    )
}

// --- Expansion source resolution ---

/**
 * Whether a candidate source transition satisfies a state trigger's arguments (REQ-430).
 *
 * Matching is keyed by argument name, ignoring purely textual rendering fields (`qualifier`,
 * `preQualifier`, `modifier`, `postQualifier`, `suffix`) that carry no semantic constraint.
 *
 * When the source's *result* declares the attribute, that is where its produced value comes
 * from: its modifier must equal the trigger argument's own — a bare trigger only matches a bare
 * result, and a modified trigger only matches a result carrying the same modifier, so two
 * occurrences that merely share an attribute name while denoting different roles (e.g. a plain
 * value vs. the next one in sequence) are never treated as the same value. Beyond that, the result side's own value (REQ-415, always a
 * plain equality assignment) must satisfy the trigger argument's own condition, if any — a side
 * with no condition/result imposes no further constraint (REQ-430). A trigger
 * argument naming an attribute the source's result doesn't declare falls back to checking whether
 * the source references that attribute at all, through its own precondition states or its own
 * trigger — the attribute is then still part of the chain's own data, just not produced by
 * this result — so only when the source never references the attribute
 * anywhere is it disqualified as not producing a value for it (REQ-430).
 *
 * @param source Candidate source transition.
 * @param triggerArgs Trigger arguments to match against.
 * @returns Whether the source satisfies the trigger arguments.
 */
function argumentsMatch(source: Transition, triggerArgs: Argument[] | undefined): boolean {
    const resultArgsByName = new Map((source.result.arguments ?? []).map((argument) => [argument.name, argument]))
    const otherwiseReferencedNames = new Set([
        ...(source.states ?? []).flatMap((stateRef) => (stateRef.arguments ?? []).map((argument) => argument.name)),
        ...(source.trigger.arguments ?? []).map((argument) => argument.name),
    ])
    return (triggerArgs ?? []).every((triggerArg) => {
        const resultArg = resultArgsByName.get(triggerArg.name)
        if (resultArg === undefined) return otherwiseReferencedNames.has(triggerArg.name)
        if (triggerArg.modifier !== resultArg.modifier) return false
        if (!triggerArg.condition || !resultArg.result) return true
        if (resultArg.result.value === undefined) return triggerArg.condition.operator === "undefined"
        // REQ-428: a reference-valued trigger condition compares two attributes *within one
        // example row*, which this structural matching stage has no row for. It therefore
        // disqualifies no candidate source here; `filterRows` applies it per row later on.
        if (triggerArg.condition.valueIsReference) return true
        // REQ-423: a reference-valued result has no row to resolve against yet at this structural
        // matching stage; `resultArg.result.value` is then the *referenced attribute's name*, not a
        // value. Comparing that name against the trigger's own condition (as any other value would
        // be) is a deliberately conservative choice: it only "matches" in the unlikely case the name
        // itself happens to satisfy the condition, so a source that cannot be verified compatible is
        // correctly excluded rather than accepted and left to fail confusingly later (row-level
        // filtering never resolves a reference — it isn't evaluated for results).
        return evaluateCondition(resultArg.result.value, triggerArg.condition)
    })
}

/**
 * Transitions whose result state name matches the trigger state name, excluding `excluded` (REQ-430).
 *
 * @param trigger State trigger to resolve.
 * @param taggedTransitions All tagged transitions.
 * @param excluded Transitions excluded from matching.
 * @returns Name-matching source candidates.
 */
export function findResultNameMatches(
    trigger: Trigger,
    taggedTransitions: TaggedTransition[],
    excluded: ReadonlySet<Transition>,
): TaggedTransition[] {
    return taggedTransitions.filter((tagged) =>
        !excluded.has(tagged.transition)
        && tagged.transition.result.name.toLowerCase() === trigger.name.toLowerCase(),
    )
}

/**
 * Transitions that can act as expansion source of a state trigger: their result state name
 * matches the trigger, and their result arguments satisfy the trigger's arguments (REQ-430).
 *
 * @param trigger State trigger to resolve.
 * @param taggedTransitions All tagged transitions.
 * @param excluded Transitions excluded from matching.
 * @returns Expansion source transitions compatible with the trigger.
 */
export function findExpansionSources(
    trigger: Trigger,
    taggedTransitions: TaggedTransition[],
    excluded: ReadonlySet<Transition>,
): TaggedTransition[] {
    return findResultNameMatches(trigger, taggedTransitions, excluded).filter((tagged) =>
        argumentsMatch(tagged.transition, trigger.arguments),
    )
}

/**
 * Whether a candidate expansion source's own precondition states conflict with `transition`'s own
 * precondition states, for a state machine both reference (REQ-430/REQ-406): differently named
 * states for the same owning machine, where the conflict is not itself resolved by recursing into
 * the source's own trigger. A source's own state-trigger targeting that same owning machine would
 * produce a (possibly different, reconciling) state for it as an intermediate result partway
 * through the chain — see `expandStateTrigger` — so that case is not a conflict. Without such a
 * further trigger, the source's own state is a raw, permanent precondition: if it names a
 * different state than `transition` requires for the same machine, both would have to hold at
 * once, which is impossible, so the source cannot be a valid causal explanation of `transition`.
 *
 * @param transition Transition whose trigger is being expanded.
 * @param source Candidate expansion source.
 * @param ownership State ownership index.
 * @returns Whether `source` is invalid as an expansion source of `transition`.
 */
function sourceConflictsWithTransition(
    transition: Transition,
    source: TaggedTransition,
    ownership: StateOwnershipIndex,
): boolean {
    const transitionStates = transition.states ?? []
    if (transitionStates.length === 0) return false

    const sourceTrigger = source.transition.trigger
    const sourceTriggerOwner = sourceTrigger.type === "state" ? ownerOfStateName(sourceTrigger.name, ownership) : undefined

    return (source.transition.states ?? []).some((sourceState) => {
        const owner = ownerOfStateRef(sourceState, ownership)
        if (!owner || owner === sourceTriggerOwner) return false
        const ownState = transitionStates.find((stateRef) => ownerOfStateRef(stateRef, ownership) === owner)
        return ownState !== undefined && ownState.name.toLowerCase() !== sourceState.name.toLowerCase()
    })
}

/**
 * Expansion sources of `trigger` compatible with `transition` (REQ-430/REQ-406): argument-matching
 * candidates (`findExpansionSources`) further narrowed to those whose own precondition states
 * don't conflict with `transition`'s own precondition states (`sourceConflictsWithTransition`).
 * `transition` is `null` only at points with no owning transition to check against (in which case
 * no conflict filtering applies).
 *
 * @param transition Transition whose trigger is being expanded, or `null` when none is available.
 * @param trigger Trigger to resolve; typically `transition?.trigger` for the top level, or a
 *   source's own trigger one level deeper in the chain.
 * @param taggedTransitions All tagged transitions.
 * @param excluded Transitions excluded from matching.
 * @param ownership State ownership index.
 * @returns Expansion source transitions compatible with both the trigger and `transition`.
 */
export function resolvableExpansionSources(
    transition: Transition | null,
    trigger: Trigger,
    taggedTransitions: TaggedTransition[],
    excluded: ReadonlySet<Transition>,
    ownership: StateOwnershipIndex,
): TaggedTransition[] {
    const sources = findExpansionSources(trigger, taggedTransitions, excluded)
    if (!transition) return sources
    return sources.filter((source) => !sourceConflictsWithTransition(transition, source, ownership))
}

/**
 * One source transition contributing to a specific expansion path, identified by its own owning
 * state machine and default preconditions — enough for a caller to independently re-derive that
 * source's own argument groups (e.g. for per-path example columns, REQ-170/REQ-171) without this
 * module depending on the example-column type.
 */
export interface ExpansionSourceStep {
    stateMachineName: string
    transition: Transition
    defaultPreconditions: DefaultPrecondition[]
}

// --- Chain analysis ---

/**
 * Whether a transition's state trigger expansion chain contains an unresolvable trigger:
 * candidate sources match by result state name, but none satisfies the argument matching rule or
 * all conflict with an own precondition state (REQ-430/REQ-406).
 *
 * Such a transition is under-specified in its own right (REQ-406), so a consumer reports that
 * rather than a consequential error about the example values it could not reach (REQ-411).
 *
 * @param transition Transition to analyze.
 * @param taggedTransitions All tagged transitions.
 * @param ownership State ownership index.
 * @param visited Source transitions already traversed.
 * @param depth Current recursion depth.
 * @returns Whether the transition chain contains an unresolvable state trigger.
 */
export function hasUnresolvableStateTrigger(
    transition: Transition,
    taggedTransitions: TaggedTransition[],
    ownership: StateOwnershipIndex,
    visited: Set<Transition> = new Set(),
    depth = 0,
): boolean {
    if (transition.trigger.type !== "state" || depth > MAX_EXPANSION_DEPTH) return false

    const excluded = new Set(visited).add(transition)
    const nameMatches = findResultNameMatches(transition.trigger, taggedTransitions, excluded)
    if (nameMatches.length === 0) return false

    const sources = resolvableExpansionSources(transition, transition.trigger, taggedTransitions, excluded, ownership)
    if (sources.length === 0) return true

    return sources.some((source) => {
        const branchVisited = new Set(visited).add(source.transition)
        return hasUnresolvableStateTrigger(source.transition, taggedTransitions, ownership, branchVisited, depth + 1)
    })
}

/**
 * Names of every state machine taking part in a transition's context: the machine declaring the
 * transition, the machines owning its default-precondition and precondition states, and — when
 * its trigger is a state trigger — the machines of every source transition reachable along the
 * expansion chain.
 *
 * These are exactly the machines whose own example values a consumer may draw on for the
 * transition, which is why the set is resolved here rather than approximated per consumer.
 *
 * @param stateMachine State machine declaring `transition`.
 * @param transition Transition whose context is being resolved.
 * @param defaultPreconditions Default preconditions applying to `transition`.
 * @param ownership State ownership index.
 * @param taggedTransitions All tagged transitions, for chain resolution.
 * @returns The participating state machine names, including `stateMachine`'s own.
 */
export function collectChainStateMachineNames(
    stateMachine: StateMachine,
    transition: Transition,
    defaultPreconditions: DefaultPrecondition[],
    ownership: StateOwnershipIndex,
    taggedTransitions: TaggedTransition[],
): Set<string> {
    const names = new Set<string>()
    const visited = new Set<Transition>()

    const collect = (
        owningName: string,
        current: Transition,
        currentDefaults: DefaultPrecondition[],
        depth: number,
    ): void => {
        names.add(owningName)
        for (const precondition of currentDefaults) {
            const owner = ownerOfStateName(precondition.state, ownership)
            if (owner) names.add(owner)
        }
        for (const stateRef of current.states ?? []) {
            const owner = ownerOfStateRef(stateRef, ownership)
            if (owner) names.add(owner)
        }
        if (current.trigger.type !== "state" || depth > MAX_EXPANSION_DEPTH) return

        const excluded = new Set(visited).add(current)
        for (const source of resolvableExpansionSources(current, current.trigger, taggedTransitions, excluded, ownership)) {
            if (visited.has(source.transition)) continue
            visited.add(source.transition)
            collect(source.stateMachineName, source.transition, source.stateMachine.defaultPreconditions ?? [], depth + 1)
        }
    }

    collect(stateMachine.name, transition, defaultPreconditions, 0)
    return names
}


/**
 * The first point along a transition's expansion chain where a state trigger names a state that
 * transitions do produce, yet none of them can act as its source (REQ-406): their arguments are
 * incompatible with the trigger's, or their own precondition states conflict with the referring
 * transition's.
 *
 * A trigger no transition produces at all is not reported here — that is a different defect, and
 * the trigger then simply has no source rather than an incompatible one.
 *
 * @param transition Transition whose chain is being inspected.
 * @param taggedTransitions All tagged transitions.
 * @param ownership State ownership index.
 * @param visited Source transitions already traversed.
 * @param depth Current recursion depth.
 * @returns The transition and trigger that cannot be resolved, or `undefined` when the whole
 *   chain resolves.
 */
export function findUnresolvableTrigger(
    transition: Transition,
    taggedTransitions: TaggedTransition[],
    ownership: StateOwnershipIndex,
    visited: Set<Transition> = new Set(),
    depth = 0,
): { transition: Transition; trigger: Trigger } | undefined {
    if (transition.trigger.type !== "state" || depth > MAX_EXPANSION_DEPTH) return undefined

    const excluded = new Set(visited).add(transition)
    const nameMatches = findResultNameMatches(transition.trigger, taggedTransitions, excluded)
    if (nameMatches.length === 0) return undefined

    const sources = resolvableExpansionSources(transition, transition.trigger, taggedTransitions, excluded, ownership)
    if (sources.length === 0) return { transition, trigger: transition.trigger }

    for (const source of sources) {
        const branchVisited = new Set(visited).add(source.transition)
        const deeper = findUnresolvableTrigger(source.transition, taggedTransitions, ownership, branchVisited, depth + 1)
        if (deeper) return deeper
    }
    return undefined
}

// --- Expansion annotation ---

/**
 * Enumerates the source chains explaining one state trigger, innermost first — the same
 * resolution `resolvableExpansionSources` performs, followed through every further state trigger
 * along the way.
 *
 * A chain stops where a source is driven by an event trigger: that event is what ultimately
 * causes the trigger being resolved. A branch that revisits a transition already on the chain, or
 * that runs past `MAX_EXPANSION_DEPTH`, contributes no chain — a cycle explains nothing, and it is
 * reported where a consumer needs it rather than here.
 *
 * @param trigger Trigger to resolve.
 * @param transition Transition declaring `trigger`, excluded from its own resolution.
 * @param ownership State ownership index.
 * @param taggedTransitions All tagged transitions.
 * @param stack Transitions already on the chain, guarding against cycles.
 * @param depth Current recursion depth.
 * @returns One chain of tagged sources per resolved path; empty when nothing explains the trigger.
 */
function resolveSourceChains(
    trigger: Trigger,
    transition: Transition,
    ownership: StateOwnershipIndex,
    taggedTransitions: TaggedTransition[],
    stack: ReadonlySet<Transition>,
    depth: number,
): TaggedTransition[][] {
    if (stack.has(transition) || depth > MAX_EXPANSION_DEPTH) return []

    const excluded = new Set(stack).add(transition)
    const sources = resolvableExpansionSources(transition, trigger, taggedTransitions, excluded, ownership)

    const nextStack = new Set(stack).add(transition)
    return sources.flatMap((source) => {
        if (source.transition.trigger.type !== "state") return [[source]]
        const deeper = resolveSourceChains(
            source.transition.trigger, source.transition, ownership, taggedTransitions, nextStack, depth + 1,
        )
        return deeper.map((chain) => [...chain, source])
    })
}

/**
 * Position of a transition within the AST, as an expansion annotation records it: the declaring
 * state machine plus the transition's index in that machine's own `transitions` array. The index
 * is what identifies the transition — a transition id is optional in the AST — and the id travels
 * along only to keep the annotation readable.
 *
 * @param source Tagged source transition to locate.
 * @returns The reference to record for `source`.
 */
function sourceReference(source: TaggedTransition): ExpansionSourceRef {
    const index = (source.stateMachine.transitions ?? []).indexOf(source.transition)
    return {
        stateMachine: source.stateMachineName,
        transitionIndex: index,
        ...(source.transition.id ? { transitionId: source.transition.id } : {}),
    }
}

/**
 * Annotates every state-triggered transition with the chains of source transitions that explain
 * its trigger (REQ-431), in place.
 *
 * The annotation is derived data: it records the resolution this module performs, so a consumer
 * need not repeat it. A consumer reading an AST without the annotation — one written by hand, or
 * by an older version — resolves the trigger itself and gets the same answer.
 *
 * An event-triggered transition is left unannotated; a state trigger that nothing explains is
 * annotated with an empty list, which says the resolution ran and found no source, as opposed to
 * not having run at all.
 *
 * @param stateMachines State machines to annotate (mutated in place).
 */
export function annotateExpansions(stateMachines: StateMachine[]): void {
    const ownership = buildStateOwnership(stateMachines)
    const taggedTransitions = buildTaggedTransitions(stateMachines)

    for (const tagged of taggedTransitions) {
        const { transition } = tagged
        if (transition.trigger.type !== "state") {
            delete transition.expansion
            continue
        }
        const chains = resolveSourceChains(
            transition.trigger, transition, ownership, taggedTransitions, new Set(), 0,
        )
        transition.expansion = chains.map((chain) => ({ sources: chain.map(sourceReference) }))
    }
}
