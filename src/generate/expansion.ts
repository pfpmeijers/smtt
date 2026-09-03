import type { Argument, DefaultPrecondition, StateMachine, StateRef, Transition, Trigger } from "../parse"
import { argumentsSignature } from "./arguments"
import { defaultPreconditionToStateRef, impliedInitialStateRefs, unrepresentedDefaultPreconditions } from "./givens"
import { ownerOfStateName, type StateOwnershipIndex } from "./ownership"
import { stateRefText, triggerText } from "./text"

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

/**
 * Error message prefix naming the state machine and transition that carry an invalid trigger.
 *
 * @param transition Transition currently being validated.
 * @param taggedTransitions All tagged transitions.
 * @returns Error message prefix for invalid trigger diagnostics.
 */
function invalidTransitionPrefix(
    transition: Transition | null,
    taggedTransitions: TaggedTransition[],
): string {
    const owner = taggedTransitions.find((tagged) => tagged.transition === transition)?.stateMachineName
        ?? "<unknown>"
    const transitionPart = transition?.id ? `transition \`${transition.id}\`` : "Anonymous transition"
    return `State machine \`${owner}\`: ${transitionPart}`
}

// --- Expansion source resolution ---

/**
 * Whether a candidate source transition's result arguments satisfy a state trigger's
 * arguments (REQ-118/REQ-161).
 *
 * Matching is keyed by argument name. A trigger argument naming an attribute the source result
 * does not declare imposes no constraint — it may still be resolvable through the combined data
 * table of the expansion chain (REQ-161). A trigger argument naming an attribute the result does
 * declare must match it exactly, so incompatible conditions on a shared attribute disqualify the
 * candidate.
 *
 * @param resultArgs Source transition result arguments.
 * @param triggerArgs Trigger arguments to match against.
 * @returns Whether the source result arguments satisfy the trigger arguments.
 */
function argumentsMatch(resultArgs: Argument[] | undefined, triggerArgs: Argument[] | undefined): boolean {
    const resultArgsByName = new Map((resultArgs ?? []).map((argument) => [argument.name, argument]))
    return (triggerArgs ?? []).every((triggerArg) => {
        const resultArg = resultArgsByName.get(triggerArg.name)
        return resultArg === undefined || argumentsSignature([resultArg]) === argumentsSignature([triggerArg])
    })
}

/**
 * Transitions whose result state name matches the trigger state name, excluding `excluded` (REQ-104).
 *
 * @param trigger State trigger to resolve.
 * @param taggedTransitions All tagged transitions.
 * @param excluded Transitions excluded from matching.
 * @returns Name-matching source candidates.
 */
function findResultNameMatches(
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
 * matches the trigger, and their result arguments satisfy the trigger's arguments (REQ-118).
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
        argumentsMatch(tagged.transition.result.arguments, trigger.arguments),
    )
}

// --- State trigger expansion ---

/** One resolved causal path from an event trigger to the transition being rendered. */
export interface ExpansionPath {
    whenText: string
    whenOwner: string
    intermediateThenTexts: string[]
    intermediateThenOwners: string[]
    injectedGivenStates: StateRef[]
}

/**
 * The `Given` states contributed by an expansion source: its default preconditions, its own
 * states, and its implied initial state (REQ-114/REQ-115/REQ-135). A default precondition is
 * only contributed when the source's own states don't already pin down a state for the same
 * owning state machine (REQ-036) — otherwise a default precondition can contradict a state the
 * source explicitly requires for that same state machine (e.g. a source whose own states require
 * a machine's initial state while its default precondition names a different state of that same
 * machine).
 *
 * @param source Expansion source transition.
 * @param ownership State ownership index.
 * @returns Effective `Given` states contributed by the source.
 */
function sourceGivenStates(source: TaggedTransition, ownership: StateOwnershipIndex): StateRef[] {
    const sourceStates = source.transition.states ?? []
    const sourceDefaultPreconditions = source.stateMachine.defaultPreconditions ?? []
    const effectiveDefaultPreconditions = unrepresentedDefaultPreconditions(sourceDefaultPreconditions, sourceStates, ownership)
    return [
        ...effectiveDefaultPreconditions.map(defaultPreconditionToStateRef),
        ...sourceStates,
        ...impliedInitialStateRefs(sourceStates, sourceDefaultPreconditions, source.stateMachine, ownership),
    ]
}

/**
 * Owning state machine name of a transition.
 *
 * @param transition Transition whose owner is requested.
 * @param taggedTransitions All tagged transitions.
 * @returns The owning state machine name, or `"<unknown>"` when unresolved.
 */
function transitionOwnerName(
    transition: Transition | null,
    taggedTransitions: TaggedTransition[],
): string {
    return taggedTransitions.find((tagged) => tagged.transition === transition)?.stateMachineName ?? "<unknown>"
}

/**
 * Reject state triggers that cannot be expanded into a unique, argument-compatible source.
 *
 * @throws Error When candidate sources span multiple state machines (REQ-154), or when
 *   candidates match by state name but none satisfies the argument matching rule
 *   (REQ-118/REQ-164).
 * @param trigger Trigger being validated.
 * @param nameMatches Name-matching source candidates.
 * @param sources Argument-compatible source candidates.
 * @param currentTransition Transition carrying the trigger.
 * @param taggedTransitions All tagged transitions.
 */
function validateExpansionSources(
    trigger: Trigger,
    nameMatches: TaggedTransition[],
    sources: TaggedTransition[],
    currentTransition: Transition | null,
    taggedTransitions: TaggedTransition[],
): void {
    const prefix = invalidTransitionPrefix(currentTransition, taggedTransitions)
    for (const candidates of [nameMatches, sources]) {
        const stateMachineNames = new Set(candidates.map((tagged) => tagged.stateMachineName))
        if (stateMachineNames.size > 1) {
            throw new Error(
                `${prefix} has an ambiguous state trigger \`${trigger.name}\` that resolves across ` +
                    `multiple state machines (${[...stateMachineNames].join(", ")}) (REQ-154).`,
            )
        }
    }
    if (nameMatches.length > 0 && sources.length === 0) {
        // Raise a targeted error rather than silently falling back to the trigger name as event.
        throw new Error(
            `${prefix} has an unresolvable state trigger \`${trigger.name}\` — no source transition's ` +
                `result arguments satisfy the trigger's argument condition(s) (REQ-118/REQ-164).`,
        )
    }
}

/**
 * Expand a state trigger into the causal paths that reach it (REQ-104/REQ-107/REQ-108).
 * Each path carries the event trigger to use as `When` step, the intermediate result states to
 * assert in chronological order (REQ-146), and the `Given` states contributed by the sources.
 *
 * @param trigger Trigger to expand.
 * @param ownership State ownership index.
 * @param taggedTransitions All transitions of all state machines.
 * @param currentTransition Transition carrying the trigger, excluded as its own source.
 * @param expansionStack Transitions already being expanded, used for cycle detection.
 * @param depth Current recursion depth.
 * @returns One path per matching source; a single verbatim path when the trigger has no source.
 * @throws Error When the expansion chain is circular (REQ-155), ambiguous (REQ-154) or
 *   unresolvable (REQ-164).
 */
export function expandStateTrigger(
    trigger: Trigger,
    ownership: StateOwnershipIndex,
    taggedTransitions: TaggedTransition[],
    currentTransition: Transition | null,
    expansionStack: ReadonlySet<Transition> = new Set(),
    depth = 0,
): ExpansionPath[] {
    void ownerOfStateName(trigger.name, ownership)

    if (currentTransition && expansionStack.has(currentTransition)) {
        throw new Error(
            `${invalidTransitionPrefix(currentTransition, taggedTransitions)} participates in a circular ` +
                `state-trigger expansion chain at trigger \`${trigger.name}\` (REQ-155).`,
        )
    }
    if (depth > MAX_EXPANSION_DEPTH) return []

    const excluded = currentTransition ? new Set([currentTransition]) : new Set<Transition>()
    const nameMatches = findResultNameMatches(trigger, taggedTransitions, excluded)
    const sources = findExpansionSources(trigger, taggedTransitions, excluded)
    validateExpansionSources(trigger, nameMatches, sources, currentTransition, taggedTransitions)

    if (sources.length === 0) {
        const ownerName = currentTransition ? transitionOwnerName(currentTransition, taggedTransitions) : "<unknown>"
        return [{
            whenText: triggerText(ownerName, trigger),
            whenOwner: ownerName,
            intermediateThenTexts: [],
            intermediateThenOwners: [],
            injectedGivenStates: [],
        }]
    }

    const nextStack = new Set(expansionStack)
    if (currentTransition) nextStack.add(currentTransition)
    return sources.flatMap((source) => {
        const sourceTransition = source.transition
        const givenStates = sourceGivenStates(source, ownership)
        const resultText = stateRefText(source.stateMachineName, sourceTransition.result, true)

        if (sourceTransition.trigger.type !== "state") {
            return [{
                whenText: triggerText(source.stateMachineName, sourceTransition.trigger),
                whenOwner: source.stateMachineName,
                intermediateThenTexts: [resultText],
                intermediateThenOwners: [source.stateMachineName],
                injectedGivenStates: givenStates,
            }]
        }

        const deeperPaths = expandStateTrigger(
            sourceTransition.trigger,
            ownership,
            taggedTransitions,
            sourceTransition,
            nextStack,
            depth + 1,
        )
        return deeperPaths.map((path) => ({
            whenText: path.whenText,
            whenOwner: path.whenOwner,
            intermediateThenTexts: [...path.intermediateThenTexts, resultText],
            intermediateThenOwners: [...path.intermediateThenOwners, source.stateMachineName],
            injectedGivenStates: [...path.injectedGivenStates, ...givenStates],
        }))
    })
}

// --- Chain analysis ---

/**
 * Names of every state machine that may contribute example value rows for a transition
 * (REQ-161): the owning state machine itself, plus — only for a state-trigger transition — the
 * state machines reached by following the trigger's expansion chain, whose Given/When/Then text
 * is stitched into this transition's own rendered scenario and therefore must share a consistent
 * value. A referenced default precondition or explicit transition state never contributes another
 * machine's table on its own, argument or not: a state machine must be sufficiently specified
 * stand-alone, so an attribute it uses in an argument is expected to be declared in — and drawn
 * from — its own `data`/example values, never another machine's.
 *
 * @param stateMachine State machine that owns the transition being rendered.
 * @param transition Transition whose contributing state machines are being collected.
 * @param defaultPreconditions Default preconditions of the owning state machine.
 * @param ownership State ownership index.
 * @param taggedTransitions All transitions of all state machines.
 * @param visited Source transitions already accounted for, preventing repeated traversal.
 * @param depth Current recursion depth.
 * @returns State machine names that can contribute rows to the transition.
 */
export function collectContributingStateMachineNames(
    stateMachine: StateMachine,
    transition: Transition,
    defaultPreconditions: DefaultPrecondition[],
    ownership: StateOwnershipIndex,
    taggedTransitions: TaggedTransition[],
    visited: Set<Transition> = new Set(),
    depth = 0,
): Set<string> {
    const names = new Set<string>([stateMachine.name])

    if (transition.trigger.type !== "state" || depth > MAX_EXPANSION_DEPTH) return names

    const excluded = new Set(visited).add(transition)
    for (const source of findExpansionSources(transition.trigger, taggedTransitions, excluded)) {
        visited.add(source.transition)
        names.add(source.stateMachineName)
        const nestedNames = collectContributingStateMachineNames(
            source.stateMachine,
            source.transition,
            source.stateMachine.defaultPreconditions ?? [],
            ownership,
            taggedTransitions,
            visited,
            depth + 1,
        )
        nestedNames.forEach((name) => names.add(name))
    }
    return names
}

/**
 * Whether a transition's state trigger expansion chain contains an unresolvable trigger:
 * candidate sources match by result state name, but none satisfies the argument matching rule
 * (REQ-118/REQ-164).
 *
 * Such a transition must not be reported as missing example values (REQ-157); the dedicated
 * REQ-164 error raised by `expandStateTrigger` takes precedence.
 *
 * @param transition Transition to analyze.
 * @param taggedTransitions All tagged transitions.
 * @param visited Source transitions already traversed.
 * @param depth Current recursion depth.
 * @returns Whether the transition chain contains an unresolvable state trigger.
 */
export function hasUnresolvableStateTrigger(
    transition: Transition,
    taggedTransitions: TaggedTransition[],
    visited: Set<Transition> = new Set(),
    depth = 0,
): boolean {
    if (transition.trigger.type !== "state" || depth > MAX_EXPANSION_DEPTH) return false

    const excluded = new Set(visited).add(transition)
    const nameMatches = findResultNameMatches(transition.trigger, taggedTransitions, excluded)
    if (nameMatches.length === 0) return false

    const sources = findExpansionSources(transition.trigger, taggedTransitions, excluded)
    if (sources.length === 0) return true

    return sources.some((source) => {
        const branchVisited = new Set(visited).add(source.transition)
        return hasUnresolvableStateTrigger(source.transition, taggedTransitions, branchVisited, depth + 1)
    })
}
