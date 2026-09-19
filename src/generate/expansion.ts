import type {
    Argument, DefaultPrecondition, ImpliedConditionsIndex, StateMachine, StateOwnershipIndex, StateRef,
    Transition, Trigger,
} from "../parse"
import {
    bindingStateRefs,
    buildTaggedTransitions,
    conflictsWithAnyState,
    findExpansionSources,
    findResultNameMatches,
    hasUnresolvableStateTrigger,
    MAX_EXPANSION_DEPTH,
    ownerOfStateName,
    ownerOfStateRef,
    preconditionGroups,
    resolvableExpansionSources,
    withImpliedStates,
    type ExpansionSourceStep,
    type TaggedTransition,
} from "../parse"

// Re-exported so a consumer keeps one import site for expansion: the structural resolution
// comes from the parse step, the rendering-side expansion from this module.
export {
    buildTaggedTransitions,
    findExpansionSources,
    hasUnresolvableStateTrigger,
    MAX_EXPANSION_DEPTH,
    resolvableExpansionSources,
}
export type { ExpansionSourceStep, TaggedTransition }
import { impliedInitialStateRefs } from "./givens"
import { stateRefText, triggerText } from "./text"

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

// --- State trigger expansion ---

/** One resolved causal path from an event trigger to the transition being rendered. */
export interface ExpansionPath {
    whenText: string
    /** Name of the resolved event trigger, without its arguments (REQ-229). */
    whenTriggerName: string
    whenOwner: string
    intermediateThenTexts: string[]
    intermediateThenOwners: string[]
    injectedGivenStates: StateRef[]
    /**
     * The specific chain of source transitions this path resolved through, innermost (closest to
     * the `When` event) first — i.e. exactly the sources whose own arguments this one path's
     * rendered steps can reference, as opposed to every resolvable source across every sibling
     * path (REQ-170/REQ-171).
     * its own.
     */
    sourceChain: ExpansionSourceStep[]
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
    const { leading, implied } = preconditionGroups(
        source.transition, sourceDefaultPreconditions, source.stateMachine, ownership,
    )
    return [
        ...leading,
        ...withImpliedStates(sourceStates, implied),
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
        // Name the specific attribute(s) rather than speaking generically of "argument
        // conditions" — the actual failure is often that no candidate references the attribute
        // at all (e.g. its result carries no argument for it), not that a value mismatched.
        const attributeNames = (trigger.arguments ?? []).map((argument) => `\`${argument.name}\``)
        const argumentWord = attributeNames.length === 1 ? "argument" : "arguments"
        const attributeList = attributeNames.length > 0 ? attributeNames.join(", ") : "its arguments"
        throw new Error(
            `${prefix} has an unresolvable state trigger \`${trigger.name}\` — no source transition ` +
                `satisfies the trigger's ${argumentWord} ${attributeList} (REQ-118/REQ-164).`,
        )
    }
}

/**
 * Immediate expansion sources of a trigger: the annotation the parse step recorded on the
 * transition (REQ-431) when it is present, and a live resolution otherwise.
 *
 * An annotation holds whole chains, innermost first, so this transition's own immediate sources
 * are the outermost entry of each chain — the recursion below then reads each source's own
 * annotation one level deeper. An AST carrying no annotation (one written by hand, or by an older
 * version) resolves identically through `resolvableExpansionSources`, at the cost of repeating
 * the work.
 *
 * @param transition Transition whose trigger is being expanded, or `null` at a point with none.
 * @param trigger Trigger to resolve.
 * @param taggedTransitions All tagged transitions.
 * @param excluded Transitions excluded from matching.
 * @param ownership State ownership index.
 * @returns The immediate source transitions.
 */
function immediateExpansionSources(
    transition: Transition | null,
    trigger: Trigger,
    taggedTransitions: TaggedTransition[],
    excluded: ReadonlySet<Transition>,
    ownership: StateOwnershipIndex,
): TaggedTransition[] {
    const annotated = transition?.expansion
    if (annotated === undefined) {
        return resolvableExpansionSources(transition, trigger, taggedTransitions, excluded, ownership)
    }

    const sources: TaggedTransition[] = []
    for (const path of annotated) {
        const outermost = path.sources[path.sources.length - 1]
        if (outermost === undefined) continue
        const tagged = taggedTransitions.find((candidate) =>
            candidate.stateMachineName === outermost.stateMachine
            && (candidate.stateMachine.transitions ?? []).indexOf(candidate.transition) === outermost.transitionIndex,
        )
        if (tagged && !excluded.has(tagged.transition) && !sources.includes(tagged)) sources.push(tagged)
    }
    return sources
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
 * @param impliedIndex Implied conditions per state name, for REQ-442 suppression in the
 *   intermediate result texts.
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
    impliedIndex: ImpliedConditionsIndex = {},
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
    const sources = immediateExpansionSources(currentTransition, trigger, taggedTransitions, excluded, ownership)
    validateExpansionSources(trigger, nameMatches, sources, currentTransition, taggedTransitions)

    if (sources.length === 0) {
        const ownerName = currentTransition ? transitionOwnerName(currentTransition, taggedTransitions) : "<unknown>"
        return [{
            whenText: triggerText(ownerName, trigger),
            whenTriggerName: trigger.name,
            whenOwner: ownerName,
            intermediateThenTexts: [],
            intermediateThenOwners: [],
            injectedGivenStates: [],
            sourceChain: [],
        }]
    }

    const nextStack = new Set(expansionStack)
    if (currentTransition) nextStack.add(currentTransition)
    const paths = sources.flatMap((source) => {
        const sourceStep: ExpansionSourceStep = {
            stateMachineName: source.stateMachineName,
            transition: source.transition,
            defaultPreconditions: source.stateMachine.defaultPreconditions ?? [],
        }
        const resultText = stateRefText(source.stateMachineName, source.transition.result, true, impliedIndex)

        if (source.transition.trigger.type !== "state") {
            return [{
                whenText: triggerText(source.stateMachineName, source.transition.trigger),
                whenTriggerName: source.transition.trigger.name,
                whenOwner: source.stateMachineName,
                intermediateThenTexts: [resultText],
                intermediateThenOwners: [source.stateMachineName],
                injectedGivenStates: sourceGivenStates(source, ownership),
                sourceChain: [sourceStep],
            }]
        }

        const deeperPaths = expandStateTrigger(
            source.transition.trigger, ownership, taggedTransitions, source.transition, impliedIndex,
            nextStack, depth + 1,
        )
        return deeperPaths.map((path) => ({
            whenText: path.whenText,
            whenTriggerName: path.whenTriggerName,
            whenOwner: path.whenOwner,
            intermediateThenTexts: [...path.intermediateThenTexts, resultText],
            intermediateThenOwners: [...path.intermediateThenOwners, source.stateMachineName],
            injectedGivenStates: [...path.injectedGivenStates, ...sourceGivenStates(source, ownership)],
            sourceChain: [...path.sourceChain, sourceStep],
        }))
    })
    return depth === 0 ? withoutPathsContradictingBinding(paths, currentTransition, ownership, taggedTransitions) : paths
}

/**
 * Drop the paths whose injected states contradict the top-level transition's binding
 * preconditions (REQ-455/REQ-458): its default preconditions and the states its own states imply.
 * A default is shorthand for stating that precondition on the transition, so a chain that starts
 * from a different state of the same machine cannot explain it.
 *
 * @param paths Resolved paths of the top-level transition's state trigger.
 * @param transition The top-level transition, or `null` when there is none.
 * @param ownership State ownership index.
 * @param taggedTransitions All transitions of all state machines.
 * @returns The paths compatible with the transition's binding preconditions.
 */
function withoutPathsContradictingBinding(
    paths: ExpansionPath[],
    transition: Transition | null,
    ownership: StateOwnershipIndex,
    taggedTransitions: TaggedTransition[],
): ExpansionPath[] {
    const owner = taggedTransitions.find((tagged) => tagged.transition === transition)
    if (!transition || !owner) return paths
    const binding = bindingStateRefs(transition, owner.stateMachine, ownership)
    if (binding.length === 0) return paths
    return paths.filter((path) => !path.injectedGivenStates.some((injected) => conflictsWithAnyState(injected, binding, ownership)))
}

// --- Chain analysis ---

/**
 * Names of every state machine that may contribute example value rows for a transition
 * (REQ-161): the owning state machine itself, plus the state machines reached along one specific
 * expansion path's own `sourceChain`, whose Given/When/Then text is stitched into this
 * transition's own rendered scenario and therefore must share a consistent value. A referenced
 * default precondition or explicit transition state never contributes another machine's table on
 * its own, argument or not: a state machine must be sufficiently specified stand-alone, so an
 * attribute it uses in an argument is expected to be declared in — and drawn from — its own
 * `data`/example values, never another machine's.
 *
 * Scoped to a single path's `sourceChain` (REQ-170/REQ-171): a sibling expansion path's source
 * machine never contributes a value column to a scenario that doesn't reference it.
 *
 * @param stateMachine State machine that owns the transition being rendered.
 * @param sourceChain The resolved expansion path's own chain of source transitions.
 * @returns State machine names that can contribute rows to the transition.
 */
export function collectContributingStateMachineNames(
    stateMachine: StateMachine,
    sourceChain: ExpansionSourceStep[],
): Set<string> {
    const names = new Set<string>([stateMachine.name])
    for (const step of sourceChain) names.add(step.stateMachineName)
    return names
}

