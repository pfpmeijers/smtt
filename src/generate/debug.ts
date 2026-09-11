import { writeFileSync } from "fs"
import { join as joinPath } from "path"
import type { Argument, Condition, Result, StateMachine, StateRef, Transition, Trigger } from "../parse"
import { attributePlaceholderName, semanticArgumentsSignature } from "./arguments"
import {
    collectChainFilterConditions,
    collectImpliedFilterConditionsForGivens,
    describeFilterCondition,
} from "./conditions"
import {
    applyAttributeAliases,
    collectContributingStateMachineNames,
    buildTaggedTransitions,
    findExpansionSources,
    isAliasedArgument,
    originalModifierOfAliasedArgument,
    reconcileAttributeAliases,
    MAX_EXPANSION_DEPTH,
    type AttributeAliasMap,
    type ExpansionSourceStep,
    type TaggedTransition,
} from "./expansion"
import {
    collectPathExampleColumns,
    describeEmptyExampleValues,
    filterRows,
    formatExamplesTable,
    mergeExampleValues,
} from "./examples"
import {
    buildImpliedConditionsIndex,
    buildStateOwnership,
    ownerOfStateRef,
    type ImpliedConditionsIndex,
    type StateOwnershipIndex,
} from "./ownership"

const DEBUG_FILE_NAME = "generate.debug.txt"

/** Indentation width, in spaces, of one nesting step (a machine bullet or a transition bullet). */
const INDENT_STEP = 4

/** Extra indentation, in spaces, of a transition's own detail lines under its bullet. */
const DETAIL_INDENT = 4

// --- Debug text rendering (state/trigger names and attributes wrapped in backticks) ---

/**
 * Render a value condition as debug text, mirroring the source markdown's own condition syntax
 * (`` `attribute` undefined ``, `` `attribute` = value ``, `` `attribute` as "value" ``, etc.), so a
 * filtered argument's condition is visible in the debug report instead of being silently dropped. A
 * reference value (REQ-423) renders backticked, exactly like the attribute name it points at,
 * distinguishing it from a quoted literal the same way the source markdown does.
 *
 * @param condition Value condition to render.
 * @returns The rendered condition text, without its surrounding markers.
 */
function debugConditionText(condition: Condition): string {
    // REQ-423: a reference renders with the name delimiter (backticks), not the literal delimiter
    // (quotes), so debug output doesn't read as though the referenced attribute's *name* were the
    // fixed value.
    if (condition.valueIsReference) return `${condition.operator} \`${condition.value}\``
    switch (condition.operator) {
        case "undefined":
            return "undefined"
        case "defined":
            return "defined"
        case "in range":
            return `in ${condition.value}`
        case "not in range":
            return `not in ${condition.value}`
        case "in":
        case "not in": {
            const values = Array.isArray(condition.value) ? condition.value : [condition.value ?? ""]
            return `${condition.operator} (${values.map((value) => `"${value}"`).join(", ")})`
        }
        case "as":
        case "not as":
            return `${condition.operator} "${condition.value}"`
        default:
            return `${condition.operator} ${condition.value}`
    }
}

/**
 * Render a result value as debug text, mirroring the source markdown's own `set to` syntax
 * (`` set to "value" ``, `` set to `other attribute` ``, `` set to undefined ``). A reference
 * value (REQ-423) renders backticked, exactly like the attribute name it points at, distinguishing
 * it from a quoted literal the same way the source markdown does. Unlike `debugConditionText`, a
 * result carries no operator to signal whether its literal is numeric or text (REQ-089: a result
 * is always a plain equality assignment), so a literal always renders quoted here rather than
 * guessing at the attribute's type from the value's own spelling.
 *
 * @param result Result value to render.
 * @returns The rendered result text, without its surrounding markers.
 */
function debugResultText(result: Result): string {
    if (result.valueIsReference) return `set to \`${result.value}\``
    if (result.value === undefined) return "set to undefined"
    return `set to "${result.value}"`
}

/**
 * Render an argument's attribute placeholder, e.g. `` `email address` ``. When the argument is a
 * rendering-only alias (REQ-422) — its modifier was rewritten from what the transition genuinely
 * declares, to match a source or caller it was reconciled against — the placeholder is suffixed
 * with a back arrow pointing at the pre-rewrite name it was substituted from, e.g. `` `different
 * email address` (←`email address`) ``, so a reconciled sub-transition's borrowed naming is
 * visible instead of looking like its own genuine declaration. Suppressed when `plain` is set (the
 * final expanded transition description, whose whole point is to read exactly like the resolved
 * scenario it produces — the same substituted value throughout, with no leftover trace of where it
 * was reconciled from).
 *
 * @param argument Argument whose placeholder is rendered.
 * @param isResult Whether the argument belongs to the transition result.
 * @param plain Whether to omit the substitution annotation even for an aliased argument.
 * @returns The rendered, backtick-wrapped placeholder text.
 */
function debugAttributePlaceholderText(argument: Argument, isResult: boolean, plain: boolean): string {
    const current = `\`${attributePlaceholderName(argument, isResult)}\``
    if (plain || !isAliasedArgument(argument)) return current
    const original = attributePlaceholderName({ ...argument, modifier: originalModifierOfAliasedArgument(argument) }, isResult)
    return `${current} (←\`${original}\`)`
}

/**
 * Render one argument as inline debug text, e.g. `` as `email address` ``. Unlike the regular
 * generated step text, the attribute placeholder is wrapped in backticks instead of quoted
 * angle brackets, matching the debug report's own notation for state/trigger names. When the
 * argument carries a value condition, it is appended using the same inline syntax as the source
 * markdown's own condition notation, e.g. `` `email address` undefined `` or `` `painting count`
 * > 1 ``, so the row filter it implies is visible instead of being silently dropped.
 *
 * @param argument Argument to render.
 * @param isFirst Whether the argument is the first one of its owner.
 * @param isResult Whether the argument belongs to the transition result.
 * @param plain Whether to omit the alias-substitution annotation (see `debugAttributePlaceholderText`).
 * @returns The rendered inline argument text, including its leading separator.
 */
function debugArgumentText(argument: Argument, isFirst: boolean, isResult: boolean, plain: boolean): string {
    const parts: string[] = []
    if (argument.qualifier) parts.push(argument.qualifier)
    if (argument.preQualifier) parts.push(argument.preQualifier)
    if (argument.postQualifier) parts.push(argument.postQualifier)
    parts.push(debugAttributePlaceholderText(argument, isResult, plain))
    if (argument.condition) parts.push(debugConditionText(argument.condition))
    else if (argument.result) parts.push(debugResultText(argument.result))
    if (argument.suffix) parts.push(argument.suffix)
    return (isFirst ? " " : ", ") + parts.join(" ")
}

/**
 * Render all arguments of a state or trigger as one inline debug text, or `""` when there are none.
 *
 * @param args Arguments to render.
 * @param isResult Whether the arguments belong to the transition result.
 * @param plain Whether to omit the alias-substitution annotation (see `debugAttributePlaceholderText`).
 * @returns The rendered argument text.
 */
function debugArgumentsText(args: Argument[] | undefined, isResult: boolean, plain: boolean): string {
    return (args ?? []).map((argument, index) => debugArgumentText(argument, index === 0, isResult, plain)).join("")
}

/**
 * Render a state reference as debug text, e.g. `` `user authenticated` as `email address` ``.
 *
 * @param stateRef State reference to render.
 * @param isResult Whether the state reference belongs to the transition result.
 * @param plain Whether to omit the alias-substitution annotation (see `debugAttributePlaceholderText`);
 *   set for the final expanded transition description, where it would otherwise be noise.
 * @returns The rendered debug text.
 */
function debugStateRefText(stateRef: StateRef, isResult = false, plain = false): string {
    return `\`${stateRef.name}\`${debugArgumentsText(stateRef.arguments, isResult, plain)}`
}

/**
 * Render a trigger as debug text, e.g. `` `painting reservation confirmed` using `email address` ``.
 *
 * @param trigger Trigger to render.
 * @param plain Whether to omit the alias-substitution annotation (see `debugAttributePlaceholderText`);
 *   set for the final expanded transition description, where it would otherwise be noise.
 * @returns The rendered debug text.
 */
function debugTriggerText(trigger: Trigger, plain = false): string {
    return `\`${trigger.name}\`${debugArgumentsText(trigger.arguments, false, plain)}`
}

// --- Precondition tagging ---

/**
 * Precondition annotation relative to the accumulated context of a candidate's ancestor chain:
 * a state whose owning machine isn't yet represented (`new`), one that repeats an already
 * established state of the exact same value (`duplicate`), one that adds an argument to an
 * already-established bare state of the same name (`specializes` — not a plain repeat, since it
 * carries information the accumulated state didn't have; mirrors `dedupeStateRefs`/REQ-116's own
 * bare-vs-specific handling), or one that contradicts an already established state of the same
 * owning machine but a different value (`conflict`).
 */
type PrecondTag = "new" | "duplicate" | "specializes" | "conflict" | "root" | null

/** One precondition state paired with its annotation relative to the accumulated context. */
interface TaggedPrecond {
    stateRef: StateRef
    tag: PrecondTag
}

const TAG_LETTER: Record<Exclude<PrecondTag, null>, string> = {
    new: "➕",
    duplicate: "↻",
    specializes: "🎯",
    conflict: "❌",
    root: "⭐",
}

/** Whether a state reference carries no arguments at all. */
function isBareStateRef(stateRef: StateRef): boolean {
    return (stateRef.arguments ?? []).length === 0
}

/** Whether an argument's own value condition requires its attribute to be absent. */
function argumentRequiresUndefined(argument: Argument): boolean {
    return argument.condition?.operator === "undefined"
}

/**
 * Whether an argument explicitly asserts its attribute is not absent via a `` not undefined ``
 * suffix (e.g. `` `painting in cart` for `email address` not undefined ``). This is descriptive
 * source text rather than a parsed `Condition`, so it can't be detected via `argument.condition`.
 */
function argumentAssertsNotUndefined(argument: Argument): boolean {
    return (argument.suffix ?? "").trim().toLowerCase() === "not undefined"
}

/**
 * Whether two same-named states are nonetheless mutually exclusive because one requires an
 * attribute to be absent (`` `attribute` undefined ``) while the other asserts, for the same
 * attribute, that it is present (`` `attribute` not undefined ``) — both cannot hold at once.
 *
 * @param a One state.
 * @param b The other state, compared by same-named arguments.
 * @returns Whether `a` and `b` have a same-named argument with contradictory undefined-ness.
 */
function argumentsConflict(a: StateRef, b: StateRef): boolean {
    const aArgs = a.arguments ?? []
    const bArgs = b.arguments ?? []
    return aArgs.some((argA) => bArgs.some((argB) =>
        argA.name.toLowerCase() === argB.name.toLowerCase()
        && ((argumentRequiresUndefined(argA) && argumentAssertsNotUndefined(argB))
            || (argumentRequiresUndefined(argB) && argumentAssertsNotUndefined(argA)))))
}

/**
 * Classify one candidate's own precondition states against the accumulated context of its
 * ancestor chain (REQ-118/REQ-164's same-owner conflict rule, applied per precondition instead
 * of as a single pass/fail filter, so the debug report can show *why* a candidate was rejected).
 * A same-named state is a conflict, rather than a duplicate, when its arguments contradict the
 * established state's arguments (`argumentsConflict`); it's a specialization, rather than a plain
 * duplicate, when one side is bare and the other carries arguments the accumulated state didn't
 * have (mirrors `dedupeStateRefs`/REQ-116, which keeps the specific reference over the bare one).
 *
 * @param states Candidate's own precondition states.
 * @param accumulated Precondition states already established by the ancestor chain.
 * @param ownership State ownership index.
 * @returns The candidate's precondition states, each paired with its tag.
 */
function tagPreconditions(
    states: StateRef[],
    accumulated: StateRef[],
    ownership: StateOwnershipIndex,
): TaggedPrecond[] {
    return states.map((stateRef) => {
        const owner = ownerOfStateRef(stateRef, ownership)
        const established = owner
            ? accumulated.find((other) => ownerOfStateRef(other, ownership) === owner)
            : undefined
        const tag: PrecondTag = !established
            ? "new"
            : established.name.toLowerCase() !== stateRef.name.toLowerCase() || argumentsConflict(established, stateRef)
                ? "conflict"
                : semanticArgumentsSignature(established.arguments) !== semanticArgumentsSignature(stateRef.arguments)
                        && (isBareStateRef(established) || isBareStateRef(stateRef))
                    ? "specializes"
                    : "duplicate"
        return { stateRef, tag }
    })
}

/**
 * Merge a candidate's own precondition states into the accumulated context (REQ-116 style
 * dedupe): a state is only appended when no already-accumulated state shares its owning machine
 * (or, for unmodeled/foreign states, its exact name) — the first-seen reference wins.
 *
 * @param accumulated Precondition states already established by the ancestor chain.
 * @param own Candidate's own precondition states to merge in.
 * @param ownership State ownership index.
 * @returns The merged, deduplicated precondition states, in first-seen order.
 */
function mergeGivens(accumulated: StateRef[], own: StateRef[], ownership: StateOwnershipIndex): StateRef[] {
    const merged = [...accumulated]
    for (const stateRef of own) {
        const owner = ownerOfStateRef(stateRef, ownership)
        const alreadyPresent = owner
            ? merged.some((other) => ownerOfStateRef(other, ownership) === owner)
            : merged.some((other) => other.name.toLowerCase() === stateRef.name.toLowerCase())
        if (!alreadyPresent) merged.push(stateRef)
    }
    return merged
}

// --- Rendering ---

/** Unicode star prefixing a root-level transition's precondition states (non-final transitions
 *  at the top level, not expanded from other transitions). */
const ROOT_PREFIX = "⭐ "

/** Unicode check mark prefixing a precondition state that is part of a fully-resolved (final,
 *  non-conflicting) expansion path — either the root transition's own states, when it isn't
 *  expanded any further, or a resolved leaf entry's merged `Given` context. */
const CHECK_PREFIX = "✅ "

/** Unicode bullet replacing the "-" of a final, fully-resolved transition or resolved
 *  expansion path — either the root transition's own bullet, when it isn't expanded any
 *  further, or a resolved leaf entry's marker. Non-final bullets keep the plain "-" dash. */
const FINAL_PREFIX = "🢂️ "

/**
 * Render one precondition line, optionally tagged, at the given indentation.
 *
 * @param tagged Precondition state and its tag; a `null` tag renders untagged (the root level).
 * @param indent Leading spaces.
 * @param isFinal Whether this untagged (root-level) precondition belongs to a fully-resolved
 *   path, i.e. one not expanded any further, and should be marked with the check prefix.
 * @returns Rendered precondition line text.
 */
function precondLineText(tagged: TaggedPrecond, indent: number, isFinal: boolean): string {
    const tagPrefix = tagged.tag === "root" ? ROOT_PREFIX : tagged.tag ? `${TAG_LETTER[tagged.tag]} ` : isFinal ? CHECK_PREFIX : ""
    return `${" ".repeat(indent)}${tagPrefix}${debugStateRefText(tagged.stateRef)}`
}

/**
 * Render a candidate transition's bullet line and detail lines (precondition states, trigger,
 * result).
 *
 * @param transition Transition to render.
 * @param tagged Candidate's own precondition states, each paired with its tag.
 * @param bulletIndent Leading spaces of the bullet line.
 * @param isFinal Whether this candidate is a fully-resolved path not expanded any further (only
 *   applies to untagged, root-level candidates), so its precondition states get the check prefix.
 * @param skipResult Whether this candidate is an intermediate expansion step (neither the initial
 *   root candidate nor a final, fully-resolved one), in which case its result line is skipped.
 * @returns Rendered lines: the bullet line followed by its detail lines.
 */
function renderCandidateLines(
    transition: Transition,
    tagged: TaggedPrecond[],
    bulletIndent: number,
    isFinal: boolean,
    skipResult: boolean = false,
): string[] {
    const idPart = transition.id ? `[${transition.id}]` : ""
    const marker = isFinal ? FINAL_PREFIX : "- "
    const detailIndent = bulletIndent + DETAIL_INDENT
    const lines: string[] = [`${" ".repeat(bulletIndent)}${marker}${idPart}`.trimEnd()]

    lines.push(...tagged.map((precond) => precondLineText(precond, detailIndent, isFinal)))
    lines.push(`${" ".repeat(detailIndent)}➡️ ${debugTriggerText(transition.trigger)}`)
    if (!skipResult) {
        lines.push(`${" ".repeat(detailIndent)}⏩ ${debugStateRefText(transition.result, true)}`)
    }
    return lines
}

/** State machines and implied-conditions index shared, unchanged, across the whole debug render. */
interface ExampleDebugContext {
    stateMachines: StateMachine[]
    impliedIndex: ImpliedConditionsIndex
}

/**
 * Render the actual `Examples:` table for one fully-resolved expansion path — or, when it comes
 * out empty, exactly which filter(s) rejected every candidate row — by reusing the very same
 * merge/filter functions the real feature generator calls (REQ-063/REQ-099/REQ-100). Sharing the
 * logic instead of re-deriving it keeps this debug view from ever disagreeing with what `generate`
 * actually does: the exact confusion this was added to resolve, where a path could look
 * fully-resolved here while `generate` still rejected it for an empty examples table.
 *
 * @param root Top-level transition the resolved path belongs to.
 * @param rootStateMachine State machine owning `root`.
 * @param sourceChain This path's own chain of expansion sources.
 * @param mergedGivens The path's full merged `Given` context, for implied-condition filters.
 * @param context Shared state machines list and implied-conditions index.
 * @param indent Leading spaces for the rendered block.
 * @returns Rendered lines describing the resolved rows, or precisely why there are none.
 */
function renderExamplesLines(
    root: Transition,
    rootStateMachine: StateMachine,
    sourceChain: ExpansionSourceStep[],
    mergedGivens: StateRef[],
    context: ExampleDebugContext,
    indent: number,
): string[] {
    const pad = " ".repeat(indent)
    const columns = collectPathExampleColumns(rootStateMachine.name, rootStateMachine.defaultPreconditions ?? [], root, sourceChain)
    if (columns.length === 0) return [`${pad}Examples: (none — plain Scenario)`]

    const contributingStateMachines = collectContributingStateMachineNames(rootStateMachine, sourceChain)
    const exampleValues = mergeExampleValues(context.stateMachines, contributingStateMachines)
    if (exampleValues.length === 0) {
        return [`${pad}Examples: EMPTY — ${describeEmptyExampleValues(contributingStateMachines)}`]
    }

    const availableAttributes = new Set(Object.keys(exampleValues[0]))
    const filters = [
        ...collectChainFilterConditions(rootStateMachine.name, root, sourceChain),
        ...collectImpliedFilterConditionsForGivens(rootStateMachine.name, mergedGivens, context.impliedIndex, availableAttributes),
    ]
    const rows = filterRows(context.stateMachines, rootStateMachine.name, exampleValues, exampleValues, filters)
    if (rows.length === 0) {
        return [
            `${pad}Examples: EMPTY — no row satisfied every filter:`,
            ...filters.map((filter) => `${pad}  - ${describeFilterCondition(filter)}`),
        ]
    }

    const table = formatExamplesTable(context.stateMachines, rootStateMachine.name, columns, rows, exampleValues)
    return table.split("\n").map((line) => `${pad}${line}`)
}

/**
 * Render the resolved leaf entry of one of the root transition's own fully-resolved expansion
 * paths: its merged `Given` context (the accumulated precondition states along this path, each
 * marked with the check prefix since the path is fully resolved), the innermost `When` event that
 * terminates the path, the root transition's own result, and the actual `Examples:` table this
 * path would produce (or why it's empty) — i.e. exactly what the root transition's generated
 * scenario would assert for this path (REQ-029 up to REQ-031). Rendered nested one indentation
 * step under the terminal candidate that reaches it (its "last transition"), without a bullet
 * dash, since it isn't itself a candidate.
 *
 * @param root Top-level transition whose expansion path is being resolved.
 * @param rootStateMachine State machine owning `root`.
 * @param rootAliases Attribute aliases (REQ-422) `root`'s own trigger/result occurrences must be
 *   rewritten to for this path, reconciling `root`'s own match against its immediate source.
 * @param sourceChain This path's own chain of expansion sources.
 * @param mergedGivens Full merged precondition context at the terminal candidate.
 * @param leafTrigger The terminal candidate's own trigger, used as the resolved `When` event.
 * @param candidateBulletIndent Leading spaces of the terminal candidate's own bullet line.
 * @param pathIndex Running count of the root's own resolved expansion paths encountered so far.
 * @param context Shared state machines list and implied-conditions index.
 * @returns Rendered lines for the resolved leaf entry.
 */
function renderResolvedLeaf(
    root: Transition,
    rootStateMachine: StateMachine,
    rootAliases: AttributeAliasMap,
    sourceChain: ExpansionSourceStep[],
    mergedGivens: StateRef[],
    leafTrigger: Trigger,
    candidateBulletIndent: number,
    pathIndex: number,
    context: ExampleDebugContext,
): string[] {
    const aliasedRoot = applyAttributeAliases(root, rootAliases)
    const indent = candidateBulletIndent + INDENT_STEP
    const idPart = `[${root.id ?? ""}.${pathIndex}]`
    const detailIndent = indent + DETAIL_INDENT
    const lines: string[] = [`${" ".repeat(indent)}${FINAL_PREFIX}${idPart}`]

    lines.push(...mergedGivens.map((stateRef) => `${" ".repeat(detailIndent)}${CHECK_PREFIX}${debugStateRefText(stateRef, false, true)}`))
    lines.push(`${" ".repeat(detailIndent)}➡️ ${debugTriggerText(leafTrigger, true)}`)
    lines.push(`${" ".repeat(detailIndent)}⏩ ${debugStateRefText(aliasedRoot.result, true)}`)
    lines.push(...renderExamplesLines(aliasedRoot, rootStateMachine, sourceChain, mergedGivens, context, indent))
    return lines
}

/**
 * Recursively render one machine's group of candidate transitions: a `- {machine}` bullet
 * followed by one bullet per candidate, each with its detail lines and, for state-triggered,
 * non-conflicting candidates, either a further nested machine group expanding its own trigger,
 * or — once the chain terminates — a resolved leaf entry for its own root transition's expansion
 * path.
 *
 * @param stateMachineName Name of the state machine owning the candidates.
 * @param candidates Candidate transitions to render (siblings satisfying the same trigger, or —
 *   at the top level — all of one state machine's own transitions, each being its own root).
 * @param accumulated Precondition states already established by the ancestor chain.
 * @param sourceChain This path's own chain of expansion sources established so far (REQ-170/171),
 *   for computing the real `Examples:` table at a resolved leaf — mirrors `ExpansionPath.sourceChain`
 *   from the real generator's own `expandStateTrigger`.
 * @param ancestorStack Transitions already on the current expansion path, for cycle detection.
 * @param indent Leading spaces of the machine bullet.
 * @param taggedTransitions All transitions tagged with owner machine name.
 * @param ownership State ownership index.
 * @param exampleContext Shared state machines list and implied-conditions index, for computing
 *   each resolved leaf's real `Examples:` table.
 * @param parentTrigger The trigger `candidates` are being matched against (REQ-422), for
 *   reconciling each candidate's own modifier against it; `null` only at the true top level, where
 *   `candidates` are independent roots rather than sources of a shared trigger.
 * @param rootAliases Attribute aliases (REQ-422) `root`'s own trigger/result occurrences must be
 *   rewritten to for paths reached through this call, reconciled once at the level immediately
 *   below the true root and threaded unchanged through deeper recursion.
 * @param depth Current recursive depth.
 * @param isRootLevel Whether `candidates` are top-level transitions being reported (each its own
 *   root, with its own resolved-leaf counter), whose own precondition states are shown untagged.
 * @param root Top-level transition being reported, for resolved leaf entries; ignored (and
 *   overridden per candidate) when `isRootLevel` is true.
 * @param leafCounter Running count of the root's own resolved expansion paths encountered so
 *   far, shared across the whole recursive render of `root`'s tree; ignored (and overridden per
 *   candidate) when `isRootLevel` is true.
 * @returns Rendered lines for the machine group.
 */
function renderMachineGroup(
    stateMachineName: string,
    candidates: Transition[],
    accumulated: StateRef[],
    sourceChain: ExpansionSourceStep[],
    ancestorStack: ReadonlySet<Transition>,
    indent: number,
    taggedTransitions: TaggedTransition[],
    ownership: StateOwnershipIndex,
    exampleContext: ExampleDebugContext,
    parentTrigger: Trigger | null,
    rootAliases: AttributeAliasMap,
    depth: number,
    isRootLevel: boolean,
    root: Transition,
    leafCounter: { count: number },
): string[] {
    const bulletIndent = indent + INDENT_STEP
    const lines = [`${" ".repeat(indent)}- \`${stateMachineName}\``]

    for (const candidate of candidates) {
        // At the root level, each candidate is its own root transition with its own resolved-leaf
        // counter; nested recursion keeps sharing the single root/counter passed down to it.
        const candidateRoot = isRootLevel ? candidate : root
        const candidateLeafCounter = isRootLevel ? { count: 0 } : leafCounter
        const candidateRootStateMachine = taggedTransitions.find((tagged) => tagged.transition === candidateRoot)!.stateMachine

        // Reconcile this candidate's own modifier against what `parentTrigger` actually asked for
        // (REQ-422): a plain trigger matched against a modified result, or vice versa, otherwise
        // renders and resolves as two different columns instead of one consistent value.
        const { callerAliases, sourceAliases } = parentTrigger
            ? reconcileAttributeAliases(parentTrigger.arguments, candidate.result.arguments)
            : { callerAliases: new Map() as AttributeAliasMap, sourceAliases: new Map() as AttributeAliasMap }
        const aliasedCandidate = applyAttributeAliases(candidate, sourceAliases)
        // `callerAliases` reconciled here is the true root's own alias only when `parentTrigger`
        // is the root's own trigger (i.e. `candidate` is one of the root's immediate sources);
        // deeper levels' own `callerAliases` would belong to an intermediate transition whose
        // lines already rendered, so there's nothing left to apply them to here — inherit instead.
        const nextRootAliases = parentTrigger === root.trigger ? callerAliases : rootAliases

        const tagged = tagPreconditions(aliasedCandidate.states ?? [], accumulated, ownership)
        const hasConflict = tagged.some((precond) => precond.tag === "conflict")

        const canRecurse = !hasConflict
            && aliasedCandidate.trigger.type === "state"
            && !ancestorStack.has(candidate)
            && depth < MAX_EXPANSION_DEPTH
        const excluded = new Set([candidate])
        const sources = canRecurse ? findExpansionSources(aliasedCandidate.trigger, taggedTransitions, excluded) : []

        // The root's own candidate is a fully-resolved, non-conflicting path in its own right
        // once it isn't expanded any further (no state-triggered sources left to recurse into).
        const isFinal = isRootLevel && !hasConflict && sources.length === 0
        const displayTagged = isRootLevel && !isFinal ? tagged.map((precond) => ({ ...precond, tag: "root" as PrecondTag })) : isRootLevel ? tagged.map((precond) => ({ ...precond, tag: null as PrecondTag })) : tagged
        // Skip result line for intermediate transitions only — always show it for the initial
        // (root-level) transition and for final, fully-resolved ones.
        const skipResult = !isRootLevel && !isFinal
        lines.push(...renderCandidateLines(aliasedCandidate, displayTagged, bulletIndent, isFinal, skipResult))
        if (isFinal) {
            lines.push(...renderExamplesLines(
                candidateRoot, candidateRootStateMachine, sourceChain, aliasedCandidate.states ?? [],
                exampleContext, bulletIndent,
            ))
        }

        if (hasConflict) continue

        const mergedGivens = mergeGivens(accumulated, aliasedCandidate.states ?? [], ownership)
        const candidateStateMachine = taggedTransitions.find((tagged) => tagged.transition === candidate)!.stateMachine
        const nextSourceChain: ExpansionSourceStep[] = [...sourceChain, {
            stateMachineName, transition: aliasedCandidate, defaultPreconditions: candidateStateMachine.defaultPreconditions ?? [],
        }]

        if (sources.length === 0) {
            // Skip the resolved leaf entry when the candidate is the root transition itself
            // (depth 0) with nothing expanded yet: it would just repeat the root's own entry.
            if (depth > 0) {
                candidateLeafCounter.count += 1
                lines.push(...renderResolvedLeaf(
                    candidateRoot, candidateRootStateMachine, nextRootAliases, nextSourceChain, mergedGivens,
                    aliasedCandidate.trigger, bulletIndent, candidateLeafCounter.count, exampleContext,
                ))
            }
            continue
        }

        const byMachine = new Map<string, Transition[]>()
        for (const source of sources) {
            const group = byMachine.get(source.stateMachineName)
            if (group) group.push(source.transition)
            else byMachine.set(source.stateMachineName, [source.transition])
        }

        const nextAncestorStack = new Set(ancestorStack)
        nextAncestorStack.add(candidate)

        for (const [sourceMachineName, sourceCandidates] of byMachine) {
            lines.push(...renderMachineGroup(
                sourceMachineName, sourceCandidates, mergedGivens, nextSourceChain, nextAncestorStack,
                bulletIndent + INDENT_STEP, taggedTransitions, ownership, exampleContext,
                aliasedCandidate.trigger, nextRootAliases, depth + 1, false, candidateRoot, candidateLeafCounter,
            ))
        }
    }

    return lines
}

/**
 * Render the full debug report for `generate` transition processing: for every state machine,
 * one `- {machine}` bullet grouping all of its own transitions, each with its recursive
 * state-trigger expansion tree, annotated with how each expansion candidate's own precondition
 * states relate to the accumulated context of its ancestor chain, and with its own resolved
 * expansion path(s) shown as leaf entries.
 *
 * @param stateMachines Parsed state machines.
 * @returns Markdown debug report text.
 */
export function renderGenerateDebugReport(stateMachines: StateMachine[]): string {
    const taggedTransitions = buildTaggedTransitions(stateMachines)
    const ownership = buildStateOwnership(stateMachines)
    const impliedIndex = buildImpliedConditionsIndex(stateMachines)
    const exampleContext: ExampleDebugContext = { stateMachines, impliedIndex }
    const lines: string[] = [
        "# SMTT Generate Debug",
        "",
        "Processed transitions and their state-trigger expansion trees.",
        "",
        "Legend:",
        "- `[...]`: transition or resolved-scenario ID",
        "- ⭐: root-level precondition state for non-final (fully expanded) transitions",
        "- ➕: new precondition state - not yet part of the accumulated context",
        "- ↻: duplicate precondition state - already accumulated, same value",
        "- 🎯: specializing precondition state - already accumulated bare, this one adds an argument",
        "- ❌: conflicting precondition state - already accumulated, different state value",
        "- ✅: precondition state of a final (fully expanded) transition",
        "- ➡️: trigger (`When`)",
        "- ⏩: result (`Then`)",
        "- 🢂️: final (fully-expanded) transition",
        "",
    ]

    for (const stateMachine of stateMachines) {
        const transitions = stateMachine.transitions ?? []
        if (transitions.length === 0) continue
        lines.push(...renderMachineGroup(
            stateMachine.name, transitions, [], [], new Set(), 0,
            taggedTransitions, ownership, exampleContext, null, new Map(), 0, true, transitions[0], { count: 0 },
        ))
    }

    lines.push("")
    return lines.join("\n")
}

/**
 * Write the `generate` debug report to disk.
 *
 * @param stateMachines Parsed state machines.
 * @param outputDir Generate output directory.
 * @returns Absolute path to the written debug report.
 */
export function writeGenerateDebugFile(
    stateMachines: StateMachine[],
    outputDir: string,
): string {
    const filePath = joinPath(outputDir, DEBUG_FILE_NAME)
    writeFileSync(filePath, renderGenerateDebugReport(stateMachines), "utf8")
    console.info("Generated: `" + filePath + "`")
    return filePath
}
