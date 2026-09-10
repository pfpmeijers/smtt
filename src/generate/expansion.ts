import type { Argument, DefaultPrecondition, StateMachine, StateRef, Transition, Trigger } from "../parse"
import { canonicalModifier } from "./arguments"
import { evaluateCondition } from "./conditions"
import { defaultPreconditionToStateRef, impliedInitialStateRefs, unrepresentedDefaultPreconditions } from "./givens"
import { ownerOfStateName, ownerOfStateRef, type StateOwnershipIndex } from "./ownership"
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
 * Whether a candidate source transition satisfies a state trigger's arguments (REQ-118).
 *
 * Matching is keyed by argument name, ignoring purely textual rendering fields (`qualifier`,
 * `preQualifier`, `modifier`, `postQualifier`, `suffix`) that carry no semantic constraint.
 *
 * When the source's *result* declares the attribute, that is where its produced value comes
 * from: its canonical modifier (REQ-085) must equal the trigger argument's own canonical modifier
 * — a bare trigger only matches a bare result, and a modified trigger only matches a result
 * carrying the same (canonicalized) modifier, so two occurrences that merely share a base
 * attribute name but denote different roles (e.g. a plain value vs. a `different` one) are never
 * silently treated as the same value. Beyond that, an equality condition on the result side (its
 * concrete value, per REQ-089) must satisfy the trigger argument's own condition, if any — a side
 * with no condition imposes no further constraint (REQ-118's matching example). A trigger
 * argument naming an attribute the source's result doesn't declare falls back to checking whether
 * the source references that attribute at all, through its own precondition states or its own
 * trigger (REQ-161: the effective data table is extended with columns contributed by the chain,
 * not only by the immediate result) — only when the source never references the attribute
 * anywhere is it disqualified as not producing a value for it (REQ-118's non-matching example).
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
        if (canonicalModifier(triggerArg) !== canonicalModifier(resultArg)) return false
        if (!triggerArg.condition || !resultArg.condition) return true
        if (resultArg.condition.operator === "undefined") return triggerArg.condition.operator === "undefined"
        if (resultArg.condition.operator === "defined") return triggerArg.condition.operator === "defined"
        const value = Array.isArray(resultArg.condition.value) ? resultArg.condition.value[0] : resultArg.condition.value
        return evaluateCondition(value, triggerArg.condition)
    })
}

// --- Attribute alias reconciliation (REQ-422) ---

/** Base attribute name → the modifier a resolved path renders/resolves it under (`undefined` for
 *  the plain, unmodified form). Absence of a key means no rewrite is needed for that attribute. */
export type AttributeAliasMap = Map<string, string | undefined>

/**
 * Reconcile a trigger's argument modifier spelling against the matched source's result argument
 * spelling (REQ-422): argument matching (REQ-118) already requires both sides to carry the same
 * canonical modifier (or neither), but two spellings of the same canonical modifier (e.g. `other`
 * vs `not`, both `different`) can still differ textually. When they do, the source side is treated
 * as deferring to the trigger's declared spelling — a transition is a parameterized function, and
 * the matched partner's declared spelling is what the value actually renders as. Bare-vs-modified
 * mismatches never reach this function: REQ-118 already excludes them as non-matching candidates.
 *

 * @param triggerArgs Trigger's own arguments.
 * @param resultArgs Matched source's own result arguments.
 * @returns `callerAliases` — attributes the referring transition's own trigger/result occurrences
 *   must be rewritten to — and `sourceAliases` — attributes the matched source's own scope
 *   (precondition states, trigger, result) must be rewritten to.
 */
export function reconcileAttributeAliases(
    triggerArgs: Argument[] | undefined,
    resultArgs: Argument[] | undefined,
): { callerAliases: AttributeAliasMap; sourceAliases: AttributeAliasMap } {
    const resultArgsByName = new Map((resultArgs ?? []).map((argument) => [argument.name, argument]))
    const callerAliases: AttributeAliasMap = new Map()
    const sourceAliases: AttributeAliasMap = new Map()
    for (const triggerArg of triggerArgs ?? []) {
        const resultArg = resultArgsByName.get(triggerArg.name)
        if (!resultArg) continue
        const effectiveModifier = triggerArg.modifier ?? resultArg.modifier
        if (triggerArg.modifier !== effectiveModifier) callerAliases.set(triggerArg.name, effectiveModifier)
        if (resultArg.modifier !== effectiveModifier) sourceAliases.set(triggerArg.name, effectiveModifier)
    }
    return { callerAliases, sourceAliases }
}

/**
 * Merge two attribute alias maps (REQ-422): entries from `second` win on key collision. Used to
 * combine the alias a source needs from its own immediate match with the alias its own trigger's
 * deeper expansion additionally requires of it, so both constraints apply to the same rewrite.
 *
 * @param first Base alias map.
 * @param second Alias map whose entries take precedence.
 * @returns The merged alias map.
 */
function mergeAttributeAliases(first: AttributeAliasMap, second: AttributeAliasMap): AttributeAliasMap {
    return second.size === 0 ? first : new Map([...first, ...second])
}

/**
 * Argument objects synthesized by {@link applyAttributeAliases} (REQ-422): each carries an
 * inherited modifier so it renders correctly, but must not be treated as an independent
 * declaration of that modifier for column or value-pool purposes (REQ-168) — the transition that
 * genuinely declared the modifier, elsewhere in the same resolved path, already does that, and is
 * guaranteed to exist (aliasing only ever copies a modifier from one side of a REQ-118 match to
 * the other; the side that already had it is left untouched and still contributes it normally).
 * Maps each rewritten argument to the modifier it carried before the rewrite, so a caller that
 * wants to show the substitution (e.g. the debug report) can reconstruct the original rendering.
 */
const aliasedArgumentOriginalModifiers = new WeakMap<Argument, string | undefined>()

/**
 * Whether `argument` is a rendering-only alias produced by {@link applyAttributeAliases} (REQ-422),
 * rather than a genuine declaration — callers building example columns should skip it, relying on
 * the genuine declaration elsewhere in the same resolved path instead.
 *
 * @param argument Argument to check.
 * @returns Whether the argument is alias-only.
 */
export function isAliasedArgument(argument: Argument): boolean {
    return aliasedArgumentOriginalModifiers.has(argument)
}

/**
 * The modifier an aliased argument (per {@link isAliasedArgument}) carried before
 * {@link applyAttributeAliases} rewrote it — e.g. `undefined` for a plain `email address` rewritten
 * to `different email address`. Only meaningful when `isAliasedArgument(argument)` is `true`.
 *
 * @param argument Aliased argument to inspect.
 * @returns The argument's pre-rewrite modifier.
 */
export function originalModifierOfAliasedArgument(argument: Argument): string | undefined {
    return aliasedArgumentOriginalModifiers.get(argument)
}

/**
 * Rewrite a transition's argument modifiers per an alias map (REQ-422), so every occurrence of an
 * aliased attribute — in its precondition states, trigger, and result, which already share one
 * value by name (REQ-063) — renders and resolves under the aliased modifier instead of its own
 * declared one.
 *
 * @param transition Transition to rewrite.
 * @param aliases Attribute aliases to apply.
 * @returns `transition` itself when no alias applies to any of its arguments; otherwise a
 *   shallow-cloned transition with the aliased arguments rewritten.
 */
export function applyAttributeAliases(transition: Transition, aliases: AttributeAliasMap): Transition {
    if (aliases.size === 0) return transition

    const rewriteArgument = (argument: Argument): Argument => {
        if (!aliases.has(argument.name)) return argument
        const modifier = aliases.get(argument.name)
        if (modifier === argument.modifier) return argument
        const rewritten: Argument = { ...argument, modifier }
        // A no-modifier `qualifier` and a with-modifier `preQualifier` render in the same position
        // (text.ts's renderArgument); moving the word across keeps its rendered position while
        // satisfying validateArgument's qualifier/modifier mutual-exclusivity rule (REQ-057).
        if (modifier !== undefined && rewritten.qualifier) {
            rewritten.preQualifier = rewritten.qualifier
            delete rewritten.qualifier
        }
        aliasedArgumentOriginalModifiers.set(rewritten, argument.modifier)
        return rewritten
    }
    const rewriteArgs = (args: Argument[] | undefined): Argument[] | undefined => args?.map(rewriteArgument)

    return {
        ...transition,
        states: transition.states?.map((stateRef) => ({ ...stateRef, arguments: rewriteArgs(stateRef.arguments) })),
        trigger: { ...transition.trigger, arguments: rewriteArgs(transition.trigger.arguments) },
        result: { ...transition.result, arguments: rewriteArgs(transition.result.arguments) },
    }
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
        argumentsMatch(tagged.transition, trigger.arguments),
    )
}

/**
 * Whether a candidate expansion source's own precondition states conflict with `transition`'s own
 * precondition states, for a state machine both reference (REQ-118/REQ-164): differently named
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
 * Expansion sources of `trigger` compatible with `transition` (REQ-118/REQ-164): argument-matching
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

// --- State trigger expansion ---

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

/** One resolved causal path from an event trigger to the transition being rendered. */
export interface ExpansionPath {
    whenText: string
    whenOwner: string
    intermediateThenTexts: string[]
    intermediateThenOwners: string[]
    injectedGivenStates: StateRef[]
    /**
     * The specific chain of source transitions this path resolved through, innermost (closest to
     * the `When` event) first — i.e. exactly the sources whose own arguments this one path's
     * rendered steps can reference, as opposed to every resolvable source across every sibling
     * path (REQ-170/REQ-171). Each step's own `transition` already has `callerAliases`-equivalent
     * rewrites from deeper matches applied (REQ-422); this array carries no further alias state of
     * its own.
     */
    sourceChain: ExpansionSourceStep[]
    /**
     * Attribute aliases (REQ-422) the referring transition's own trigger/result occurrences must
     * be rewritten to for this path, reconciling this path's top-level match. Empty when the top
     * match's trigger and matched result already agree on every shared attribute's modifier (or
     * carries no arguments, e.g. a plain event trigger).
     */
    callerAliases: AttributeAliasMap
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
    const sources = resolvableExpansionSources(currentTransition, trigger, taggedTransitions, excluded, ownership)
    validateExpansionSources(trigger, nameMatches, sources, currentTransition, taggedTransitions)

    if (sources.length === 0) {
        const ownerName = currentTransition ? transitionOwnerName(currentTransition, taggedTransitions) : "<unknown>"
        return [{
            whenText: triggerText(ownerName, trigger),
            whenOwner: ownerName,
            intermediateThenTexts: [],
            intermediateThenOwners: [],
            injectedGivenStates: [],
            sourceChain: [],
            callerAliases: new Map(),
        }]
    }

    const nextStack = new Set(expansionStack)
    if (currentTransition) nextStack.add(currentTransition)
    return sources.flatMap((source) => {
        const { callerAliases, sourceAliases } = reconcileAttributeAliases(trigger.arguments, source.transition.result.arguments)
        // Apply what this match alone requires before recursing, so a deeper reconciliation (which
        // matches this source's own trigger) sees this attribute's already-aliased modifier rather
        // than its raw declared one (REQ-422).
        const partiallyAliasedSource = applyAttributeAliases(source.transition, sourceAliases)

        if (partiallyAliasedSource.trigger.type !== "state") {
            const aliasedSource = partiallyAliasedSource
            const resultText = stateRefText(source.stateMachineName, aliasedSource.result, true)
            const sourceStep: ExpansionSourceStep = {
                stateMachineName: source.stateMachineName,
                transition: aliasedSource,
                defaultPreconditions: source.stateMachine.defaultPreconditions ?? [],
            }
            return [{
                whenText: triggerText(source.stateMachineName, aliasedSource.trigger),
                whenOwner: source.stateMachineName,
                intermediateThenTexts: [resultText],
                intermediateThenOwners: [source.stateMachineName],
                injectedGivenStates: sourceGivenStates({ ...source, transition: aliasedSource }, ownership),
                sourceChain: [sourceStep],
                callerAliases,
            }]
        }

        const deeperPaths = expandStateTrigger(
            partiallyAliasedSource.trigger,
            ownership,
            taggedTransitions,
            source.transition,
            nextStack,
            depth + 1,
        )
        return deeperPaths.map((path) => {
            // The deeper match may additionally constrain this source's own modifier for an
            // attribute (e.g. its own trigger argument had none, so it deferred to what its own
            // source produced) — merge that into what this level's match already required, then
            // apply once to the original, undecorated transition (REQ-422).
            const aliasedSource = applyAttributeAliases(source.transition, mergeAttributeAliases(sourceAliases, path.callerAliases))
            const resultText = stateRefText(source.stateMachineName, aliasedSource.result, true)
            const sourceStep: ExpansionSourceStep = {
                stateMachineName: source.stateMachineName,
                transition: aliasedSource,
                defaultPreconditions: source.stateMachine.defaultPreconditions ?? [],
            }
            return {
                whenText: path.whenText,
                whenOwner: path.whenOwner,
                intermediateThenTexts: [...path.intermediateThenTexts, resultText],
                intermediateThenOwners: [...path.intermediateThenOwners, source.stateMachineName],
                injectedGivenStates: [...path.injectedGivenStates, ...sourceGivenStates({ ...source, transition: aliasedSource }, ownership)],
                sourceChain: [...path.sourceChain, sourceStep],
                callerAliases,
            }
        })
    })
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

/**
 * Whether a transition's state trigger expansion chain contains an unresolvable trigger:
 * candidate sources match by result state name, but none satisfies the argument matching rule or
 * all conflict with an own precondition state (REQ-118/REQ-164).
 *
 * Such a transition must not be reported as missing example values (REQ-157); the dedicated
 * REQ-164 error raised by `expandStateTrigger` takes precedence.
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
