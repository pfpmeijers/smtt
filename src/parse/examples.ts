/**
 * Example values of a transition: the rows a transition's attributes can take.
 *
 * A state machine declares example values of its own, but a transition may reference attributes
 * another machine declares — through the chain of sources explaining its state trigger. Which
 * rows are effectively available to a transition is therefore a property of the parsed model, and
 * is resolved here rather than per consumer.
 */

import { type FilterCondition, evaluateCondition, resolveConditionReference } from "./conditions"
import { collectChainStateMachineNames, type TaggedTransition } from "./expand"
import type { StateOwnershipIndex } from "./ownership"
import { attributePlaceholderName, modifierColumnName, resultingColumnName } from "./arguments"
import type { Argument, DefaultPrecondition, StateMachine, Transition } from "./sm.ast.d"

/** One row of example attribute values, keyed by attribute name. */
export type ExampleRow = Record<string, string>

// --- Value tables ---

/**
 * Merge one contributing state machine's table into an accumulated row set. A column the
 * accumulator already has wins outright and is never second-guessed against another machine's
 * values for the same attribute name — a state machine's own declared examples are authoritative
 * for its own attributes (REQ-168). Only genuinely new columns (attributes the accumulator has no
 * value for yet, e.g. from a state-trigger expansion source, REQ-161) are added, cross-joined
 * against the accumulator's existing rows.
 *
 * @param accumulated Rows accumulated so far; its columns are already settled.
 * @param table Next contributing state machine's own example rows.
 * @returns `accumulated`, extended with any columns from `table` it didn't already have.
 */
function mergeInNewColumns(accumulated: ExampleRow[], table: ExampleRow[]): ExampleRow[] {
    const knownColumns = new Set(Object.keys(accumulated[0] ?? {}))
    const newColumns = Object.keys(table[0] ?? {}).filter((key) => !knownColumns.has(key))
    if (newColumns.length === 0) return accumulated

    const mergedRows: ExampleRow[] = []
    for (const accumulatedRow of accumulated) {
        for (const tableRow of table) {
            const extension: ExampleRow = {}
            for (const key of newColumns) extension[key] = tableRow[key]
            mergedRows.push({ ...accumulatedRow, ...extension })
        }
    }
    return mergedRows
}

/**
 * Effective example value table of a transition: the owning state machine's own `dataValueCombinations`
 * (first and authoritative for every attribute it declares itself, REQ-168), extended only with
 * columns for attributes it does not declare, contributed by other state machines in its
 * state-trigger expansion chain (REQ-068/REQ-161). State machines without example values impose no
 * constraint; the result is empty only when none of the contributing machines defines any rows.
 *
 * @param stateMachines State machines available for lookup.
 * @param stateMachineNames Names of contributing state machines, in the order they were collected
 *   (the owning state machine first).
 * @returns The merged example rows.
 */
export function mergeExampleValues(
    stateMachines: StateMachine[],
    stateMachineNames: Iterable<string>,
): ExampleRow[] {
    const tables = [...stateMachineNames]
        .map((name) => stateMachines.find((stateMachine) => stateMachine.name === name)?.dataValueCombinations ?? [])
        .filter((table) => table.length > 0)
    if (tables.length === 0) return []
    return tables.reduce((accumulated, table) => mergeInNewColumns(accumulated, table))
}

/**
 * Effective example rows of a transition: the merged table of every state machine taking part in
 * its context (REQ-411), its own machine first.
 *
 * @param stateMachines All state machines, for lookup.
 * @param stateMachine State machine declaring `transition`.
 * @param transition Transition whose example rows are being resolved.
 * @param defaultPreconditions Default preconditions applying to `transition`.
 * @param ownership State ownership index.
 * @param taggedTransitions All tagged transitions, for chain resolution.
 * @returns The merged example rows; empty when no participating machine declares any.
 */
export function effectiveExampleValues(
    stateMachines: StateMachine[],
    stateMachine: StateMachine,
    transition: Transition,
    defaultPreconditions: DefaultPrecondition[],
    ownership: StateOwnershipIndex,
    taggedTransitions: TaggedTransition[],
): ExampleRow[] {
    const contributingNames = collectChainStateMachineNames(
        stateMachine, transition, defaultPreconditions, ownership, taggedTransitions,
    )
    return mergeExampleValues(stateMachines, contributingNames)
}

// --- Rows ---


/**
 * Produce a canonical serialization of a row for stable deduplication.
 *
 * @param row Row to serialize.
 * @returns A deterministic key that ignores object insertion order.
 */
function rowSignature(row: ExampleRow): string {
    return Object.entries(row)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, value]) => `${key}=${String(value)}`)
        .join("|")
}

/**
 * Remove duplicate example rows while preserving the first occurrence of each row.
 *
 * @param rows Rows to suppress duplicates from.
 * @returns A new array with the first instance of each row retained.
 */
export function deduplicateRows(rows: ExampleRow[]): ExampleRow[] {
    const seen = new Set<string>()
    const uniqueRows: ExampleRow[] = []
    for (const row of rows) {
        const signature = rowSignature(row)
        if (seen.has(signature)) continue
        seen.add(signature)
        uniqueRows.push(row)
    }
    return uniqueRows
}

/**
 * Remove duplicate rendered value tuples while preserving the first occurrence of each one.
 *
 * @param cells Rows of rendered cell text.
 * @returns A de-duplicated list of rows in their first-seen order.


/**
 * Derive the value for an incremented or decremented modifier from a numeric source value.
 *
 * @param stateMachineName Name of the state machine owning the transition, for error context.
 * @param sourceValue Current attribute value in the source row.
 * @param modifier Modifier to apply.
 * @param attributeName Attribute being evaluated.
 * @param sourceContext Human-readable label of the precondition/trigger/result the modifier was declared on.
 * @param transitionLabel Label of the owning transition, for error context.
 * @returns The incremented or decremented value as a string.
 * @throws Error When the source value is not numeric.
 */
function steppedValue(
    stateMachineName: string,
    sourceValue: string | undefined,
    modifier: string,
    attributeName: string,
    sourceContext: string | undefined,
    transitionLabel: string | undefined,
): string {
    const numericValue = Number(sourceValue)
    if (Number.isNaN(numericValue)) {
        throw new Error(
            `State machine \`${stateMachineName}\`: ${transitionLabel ?? "Anonymous transition"}: ` +
                `Invalid modifier \`${modifier}\` for attribute \`${attributeName}\` on ${sourceContext ?? "unknown source"}: ` +
                `expected a numeric value but got ${JSON.stringify(sourceValue)}`,
        )
    }
    return String(numericValue + (modifier === "incremented" ? 1 : -1))
}

/**
 * Rotate a row index through the available example rows for circular `next` / `previous` logic.
 *
 * @param attributeName Attribute to read from the shifted row.
 * @param rowIndex Index of the current row.
 * @param shift Number of steps to shift by.
 * @param rows Original example rows.
 * @returns The shifted attribute value, or an empty string when no rows exist.
 */
function shiftedValue(attributeName: string, rowIndex: number, shift: number, rows: ExampleRow[]): string {
    if (rows.length === 0) return ""
    const shiftedIndex = ((rowIndex + shift) % rows.length + rows.length) % rows.length
    return rows[shiftedIndex][attributeName] ?? ""
}

/**
 * Resolve the value of a modifier column for one row. Modifiers are resolved against the
 * declaring state machine's own example values table only — the column's `poolStateMachineName`
 * when set (REQ-168: for a state-trigger expansion source, that source's own machine, not
 * necessarily the transition being rendered), falling back to the rendering machine otherwise —
 * never the cross-machine joined table used for base columns, since a state machine must be
 * sufficiently specified stand-alone.
 *
 * @param stateMachines All state machines, to look up the declaring state machine's own example values.
 * @param stateMachineName Name of the state machine owning the transition being rendered, used as
 *   the pool machine only when `column.poolStateMachineName` is absent.
 * @param column Modifier column to evaluate.
 * @param row Row containing the source value.
 * @param sourceRowIndex Index of the row in the original, joined value table (fallback only).
 * @param allRows Original, unfiltered, cross-machine joined example rows (unused by modifiers themselves).
 * @returns The derived cell value, or an empty string for unknown modifiers.
 * @throws Error When the declaring state machine defines no example values, or when the modifier
 *   cannot otherwise be derived from the available values.

/**
 * Value a modified argument denotes for one row: the attribute's own value stepped, shifted, or
 * taken from a boundary of the pool its declaring state machine provides.
 *
 * Modifiers resolve against the declaring machine's own example values only — a state machine is
 * sufficiently specified stand-alone — so the pool is that machine's own table rather than the
 * merged one the transition draws on.
 *
 * @param stateMachines All state machines, for looking up the pool.
 * @param poolStateMachineName State machine whose example values the modifier resolves against.
 * @param attributeName Attribute the modifier applies to.
 * @param modifier Modifier to derive.
 * @param row Row under evaluation.
 * @param sourceRowIndex Index of `row` in the table it came from, used when the pool holds no
 *   row carrying the attribute's current value.
 * @param context Human-readable labels for error messages.
 * @returns The derived value, or an empty string for an unknown modifier.
 * @throws Error When the declaring state machine defines no example values, or when a stepped
 *   modifier meets a non-numeric value.
 */
export function derivedModifierValue(
    stateMachines: StateMachine[],
    poolStateMachineName: string,
    attributeName: string,
    modifier: string | undefined,
    row: ExampleRow,
    sourceRowIndex: number,
    context: { sourceModifier?: string; sourceContext?: string; transitionLabel?: string },
): string {
    const sourceValue = row[attributeName]
    const pool = stateMachines.find((stateMachine) => stateMachine.name === poolStateMachineName)?.dataValueCombinations ?? []
    if (pool.length === 0) {
        throw new Error(
            `State machine \`${poolStateMachineName}\`: ${context.transitionLabel ?? "Anonymous transition"}: ` +
                `Invalid modifier \`${context.sourceModifier ?? modifier}\` for attribute \`${attributeName}\` ` +
                `on ${context.sourceContext ?? "unknown source"}: state machine defines no example values of its own`,
        )
    }
    const poolRowIndex = pool.findIndex((candidateRow) => (candidateRow[attributeName] ?? "") === (sourceValue ?? ""))
    const effectiveRowIndex = poolRowIndex >= 0 ? poolRowIndex : sourceRowIndex

    switch (modifier) {
        case "incremented":
        case "decremented":
            return steppedValue(
                poolStateMachineName, sourceValue, modifier, attributeName, context.sourceContext, context.transitionLabel,
            )
        case "first":
            return pool[0]?.[attributeName] ?? ""
        case "last":
            return pool[pool.length - 1]?.[attributeName] ?? ""
        case "next":
            return shiftedValue(attributeName, effectiveRowIndex, 1, pool)
        case "previous":
            return shiftedValue(attributeName, effectiveRowIndex, -1, pool)
        default:
            return ""
    }
}

// --- Sameness bindings ---

/**
 * A sameness binding: the attribute takes `value` — a literal, or, when `valueIsReference`, the
 * value the named attribute holds in the same row. Written `` `attr` as … `` (REQ-432).
 *
 * A binding is not a filter. It states what the attribute's value *is*, so it is satisfied by
 * construction rather than searched for among pre-existing rows — which is what lets two state
 * machines relate their attributes without having to declare coinciding literals.
 */
export interface Binding {
    attribute: string
    value: string
    valueIsReference: boolean
}

/**
 * Split collected conditions into sameness bindings and the conditions that genuinely filter
 * (REQ-432). Only the `as` operator binds; `=`/`is`, `<>`/`is not`, the ordering, set, range and
 * presence operators all state a test and stay filters.
 *
 * An `as` carrying a modifier stays a filter: it constrains a *derived* value (e.g. the next value
 * in sequence), which is not something a row's own column can simply be assigned.
 *
 * @param conditions Conditions collected for one transition and its expansion chain.
 * @returns The bindings and the remaining filters.
 */
export function partitionConditions(
    conditions: FilterCondition[],
): { bindings: Binding[]; filters: FilterCondition[] } {
    const bindings: Binding[] = []
    const filters: FilterCondition[] = []
    for (const entry of conditions) {
        const { condition } = entry
        if (condition.operator === "as" && !entry.modifier && typeof condition.value === "string") {
            bindings.push({
                attribute: entry.sourceName,
                value: condition.value,
                valueIsReference: condition.valueIsReference === true,
            })
            continue
        }
        filters.push(entry)
    }
    return { bindings, filters }
}

/**
 * Apply sameness bindings to every row (REQ-432): each bound attribute takes its literal, or the
 * value its referenced attribute holds in that same row.
 *
 * Bindings are applied before filtering, so a filter on a bound attribute tests the value the
 * binding gave it rather than whatever the table happened to hold.
 *
 * A row whose reference cannot be resolved — the referenced attribute has no column in the
 * effective table, or holds no value in this row — does not survive: there is no value for the
 * bound attribute to take, so the sameness the author stated cannot hold for that row (REQ-427).
 *
 * @param rows Rows to bind.
 * @param bindings Bindings to apply; no bindings returns `rows` unchanged.
 * @returns The rows with every binding applied, minus those that could not satisfy one.
 */
export function applyBindings(rows: ExampleRow[], bindings: Binding[]): ExampleRow[] {
    if (bindings.length === 0) return rows
    const bound: ExampleRow[] = []
    for (const row of rows) {
        const boundRow: ExampleRow = { ...row }
        let unresolvable = false
        // A reference chain (`a` as `b`, `b` as `c`) settles by repetition: every pass propagates
        // one more link, so a pass that changes nothing means all bindings hold. The pass cap also
        // stops a cycle (`a` as `b`, `b` as `a`) from spinning.
        for (let pass = 0; pass <= bindings.length && !unresolvable; pass++) {
            let changed = false
            for (const binding of bindings) {
                const value = binding.valueIsReference ? boundRow[binding.value] : binding.value
                if (value === undefined || value === "") {
                    unresolvable = true
                    break
                }
                if (boundRow[binding.attribute] === value) continue
                boundRow[binding.attribute] = value
                changed = true
            }
            if (!changed) break
        }
        if (!unresolvable) bound.push(boundRow)
    }
    return bound
}

// --- Rows ---

/**
 * Keep the rows satisfying all filters (REQ-069/REQ-099). A filter carrying a modifier is
 * evaluated against the derived value rather than the base value (REQ-143/REQ-144). A filter whose
 * condition value is an attribute reference is resolved against the row being tested (REQ-427), so
 * it compares two values of that same row; a row that cannot resolve the reference — the
 * referenced attribute has no column in the effective table, or no value in this row — does not
 * survive.
 *
 * @param stateMachines All state machines for looking up example values.
 * @param stateMachineName Name of the state machine owning the transition, for error context.
 * @param rows Rows to filter.
 * @param allRows Original, unfiltered table used for positional modifier derivation.
 * @param filters Filters to apply; no filters keep all rows.
 * @returns The surviving rows.
 */
export function filterRows(
    stateMachines: StateMachine[],
    stateMachineName: string,
    rows: ExampleRow[],
    allRows: ExampleRow[],
    filters: FilterCondition[],
): ExampleRow[] {
    const filteredRows = filters.length === 0
        ? rows
        : rows.filter((row, rowIndex) =>
            filters.every(({ sourceName, sourceModifier, modifier, condition }) => {
                const value = modifier
                    ? derivedModifierValue(
                        stateMachines, stateMachineName, sourceName, modifier, row, rowIndex, { sourceModifier })
                    : row[sourceName]
                const resolvedCondition = resolveConditionReference(condition, row)
                if (resolvedCondition === undefined) return false
                return evaluateCondition(value, resolvedCondition)
            }),
        )
    return deduplicateRows(filteredRows)
}

import type { ExpansionSourceStep } from "../parse"

/**
 * Describe a transition by its id, for use in error messages.
 *
 * @param transition Transition to describe.
 * @returns The transition description.
 */
export function transitionDescription(transition: Transition): string {
    return transition.id ? `transition \`${transition.id}\`` : "Anonymous transition"
}

/**
 * Remove duplicate rendered value tuples while preserving the first occurrence of each one.
 *
 * @param cells Rows of rendered cell text.
 * @returns A de-duplicated list of rows in their first-seen order.


/**
 * Describe why `mergeExampleValues` produced no rows for a set of contributing state machines
 * (REQ-157/REQ-163): none of them defines any example values of its own.
 *
 * @param stateMachineNames Names of contributing state machines.
 * @returns A clause naming the responsible state machine(s), for use after "but " in an error message.
 */
export function describeEmptyExampleValues(stateMachineNames: Iterable<string>): string {
    const names = [...stateMachineNames]
    return names.length === 1
        ? "the state machine's dataValueCombinations table is empty or absent"
        : `the dataValueCombinations tables of state machines ${names.map((name) => `\`${name}\``).join(", ")} are empty or absent`
}

// --- Columns ---

/** Column kinds of an examples table: a plain attribute, a modifier derivation, a result value. */
type ColumnKind = "base" | "modifier" | "result"

/** One column of the examples table, carrying how its cell values are derived. */
export interface ExampleColumn {
    kind: ColumnKind
    /** Rendered header text. */
    name: string
    /** Base attribute name the column derives from. */
    sourceName: string
    /** Canonical modifier of a `modifier` column. */
    modifier?: string
    /** Original modifier text from source for error reporting. */
    sourceModifier?: string
    /** Human-readable label (e.g. `` state `X` ``) of the precondition/trigger/result the modifier argument was declared on, for error reporting. */
    sourceContext?: string
    /** Label of the owning transition (e.g. `` transition `019` ``), for error reporting. */
    transitionLabel?: string
    /**
     * Fixed cell value of a `result` column, or — when `valueIsReference` is set — the
     * name of the attribute whose row value the cell resolves to dynamically instead.
     */
    resultValue?: string
    /**
     * Whether `resultValue` names another attribute to resolve dynamically per row (REQ-423),
     * rather than being the fixed literal cell value itself.
     */
    valueIsReference?: boolean
    /**
     * State machine whose own `dataValueCombinations` a `modifier` column resolves against (REQ-168):
     * the machine that declared the modifier argument, which for a state-trigger expansion source
     * (REQ-161) is that source's own machine, not necessarily the transition being rendered.
     * Falls back to the rendering machine when absent.
     */
    poolStateMachineName?: string
}

/** One argument group scanned for example columns, tagged with its declaring context. */
interface ArgumentGroup {
    args: Argument[]
    isResult: boolean
    /** Human-readable label (e.g. `` state `X` ``) for use in error messages. */
    source: string
    /** State machine that declared this group's arguments — the modifier pool machine (REQ-168). */
    poolStateMachineName: string
    /** Transition that declared this group's arguments, for error-message context. */
    sourceTransition: Transition
}

/**
 * Collect the argument groups of a single transition (not following any state-trigger
 * expansion) in the order they are scanned for example columns. Each group carries a
 * human-readable `source` label (e.g. `` state `X` `` or `` result `X` ``) identifying which
 * precondition, trigger, or result the group's arguments were declared on, for use in error
 * messages, and is tagged with `stateMachineName` as both the declaring machine (for modifier
 * pool resolution, REQ-168) and `transition` as the declaring transition (for error context).
 *
 * @param stateMachineName State machine that declares `transition` and `defaultPreconditions`.
 * @param transition Transition being inspected.
 * @param defaultPreconditions Default preconditions attached to the owning state machine.
 * @returns Argument groups in scan order, including result arguments flagged for result processing.
 */
function argumentGroups(
    stateMachineName: string,
    transition: Transition,
    defaultPreconditions: DefaultPrecondition[],
): ArgumentGroup[] {
    const tag = { poolStateMachineName: stateMachineName, sourceTransition: transition }
    return [
        ...defaultPreconditions.map((precondition) => ({
            args: precondition.arguments ?? [], isResult: false,
            source: `default precondition \`${precondition.state}\``, ...tag,
        })),
        ...(transition.states ?? []).map((stateRef) => ({
            args: stateRef.arguments ?? [], isResult: false, source: `state \`${stateRef.name}\``, ...tag,
        })),
        { args: transition.trigger.arguments ?? [], isResult: false, source: `trigger \`${transition.trigger.name}\``, ...tag },
        { args: transition.result.arguments ?? [], isResult: true, source: `result \`${transition.result.name}\``, ...tag },
    ]
}

/**
 * Read the value carried by a result argument: a fixed literal, or — when the result
 * is a reference (REQ-423) — the name of the attribute to resolve dynamically per row instead.
 *
 * @param argument Result argument whose result value should be extracted.
 * @returns The result's value, or an empty string when no value is present (the attribute is set
 *   to undefined).
 */
function resultValue(argument: Argument): string {
    return argument.result?.value ?? ""
}

/**
 * Derived column of a modifier argument (REQ-076).
 *
 * @param group Argument group the modifier argument belongs to (supplies the pool state machine
 *   and declaring transition for error context, REQ-168).
 * @param argument Modifier argument to turn into a derived column.
 * @param baseReferenceNames Base attribute names referenced anywhere in the transition (or, for a
 *   chain-merged column set, anywhere across the whole expansion chain).
 * @returns The derived modifier column.
 * @throws Error When the transition holds no base references for the modified attribute (REQ-136).
 */
function modifierColumn(
    group: ArgumentGroup,
    argument: Argument,
    baseReferenceNames: ReadonlySet<string>,
): ExampleColumn {
    const { poolStateMachineName, sourceTransition, source } = group
    const transitionLabel = transitionDescription(sourceTransition)
    if (!baseReferenceNames.has(argument.name)) {
        throw new Error(
            `State machine \`${poolStateMachineName}\`: ${transitionLabel}: Invalid modifier \`${argument.modifier}\` ` +
                `for attribute \`${argument.name}\` on ${source}: no base reference found in the transition`,
        )
    }
    return {
        kind: "modifier",
        name: modifierColumnName(argument) as string,
        sourceName: argument.name,
        modifier: argument.modifier,
        sourceModifier: argument.modifier,
        sourceContext: source,
        transitionLabel,
        poolStateMachineName,
    }
}

/**
 * Columns derived from a set of already-collected argument groups: every referenced base
 * attribute in first-encounter order, followed by the derived modifier and result value
 * columns in their encounter order (REQ-064/REQ-065/REQ-066/REQ-151/REQ-152).
 *
 * @param groups Argument groups in scan order (REQ-064), e.g. from `argumentGroups` for a single
 *   transition or `collectChainArgumentGroups` for a whole expansion chain (REQ-161).
 * @returns The ordered columns; empty when no group references any argument at all, in which
 *   case a plain `Scenario` is rendered instead of a `Scenario Outline` (REQ-047).
 * @throws Error When a modifier argument has no base references among `groups` (REQ-136).
 */
function buildExampleColumns(groups: ArgumentGroup[]): ExampleColumn[] {
    const baseReferenceNames = new Set(
        groups.flatMap(({ args }) => args.filter((argument) => !argument.modifier).map((argument) => argument.name)),
    )

    const baseColumns: ExampleColumn[] = []
    const derivedColumns: ExampleColumn[] = []
    const addBase = (name: string) => {
        if (baseColumns.some((column) => column.name === name)) return
        baseColumns.push({ kind: "base", name, sourceName: name })
    }
    const addDerived = (column: ExampleColumn) => {
        const isKnown = baseColumns.some((known) => known.name === column.name)
            || derivedColumns.some((known) => known.name === column.name)
        if (!isKnown) derivedColumns.push(column)
    }

    for (const group of groups) {
        const { args, isResult } = group
        for (const argument of args) {
            // A result argument set to a value renders as `<resulting X>`, never `<X>`
            // (see `attributePlaceholderName`), so it contributes no base column of its own.
            const hasResultValue = isResult && argument.result
            if (argument.modifier) {
                addDerived(modifierColumn(group, argument, baseReferenceNames))
            } else if (!hasResultValue) {
                addBase(argument.name)
            }
            if (hasResultValue) {
                addDerived({
                    kind: "result",
                    name: resultingColumnName(argument.name),
                    sourceName: argument.name,
                    resultValue: resultValue(argument),
                    valueIsReference: argument.result!.valueIsReference,
                })
            }
        }
    }
    return [...baseColumns, ...derivedColumns]
}

/**
 * Columns of the examples table of a single transition, not following any state-trigger
 * expansion (REQ-064/REQ-065/REQ-066/REQ-151/REQ-152).
 *
 * @param stateMachineName Name of the state machine owning the transition, for error context.
 * @param defaultPreconditions Default preconditions of the owning state machine.
 * @param transition Transition whose examples columns are being collected.
 * @returns The ordered columns; empty when the transition references no arguments at all,
 *   in which case a plain `Scenario` is rendered instead of a `Scenario Outline` (REQ-047).
 * @throws Error When a modifier argument has no base references in the transition (REQ-136).
 */
export function collectExampleColumns(
    stateMachineName: string,
    defaultPreconditions: DefaultPrecondition[],
    transition: Transition,
): ExampleColumn[] {
    return buildExampleColumns(argumentGroups(stateMachineName, transition, defaultPreconditions))
}

/**
 * Columns of the examples table of one resolved expansion path of a transition (REQ-170/REQ-171):
 * the top-level transition's own columns, plus any base or modifier
 * columns declared only on *this path's own* chain of expansion sources' precondition states,
 * trigger, or result — e.g. a `not`/`different` modifier declared on a source's own state, which
 * only shows up as an injected `Given` step (REQ-114/REQ-115) on this specific path and would
 * otherwise have no column to resolve its placeholder against.
 *
 * Only `sourceChain` — the specific sources *this* path resolved through — contributes columns,
 * not every resolvable source of the transition's trigger: a sibling path's own argument (e.g.
 * another source's modifier) must not leak a column, with values, into a scenario whose rendered
 * steps never reference it.
 *
 * @param stateMachineName Name of the state machine owning the transition, for error context.
 * @param defaultPreconditions Default preconditions of the owning state machine.
 * @param transition Transition whose examples columns are being collected.
 * @param sourceChain The one expansion path's own chain of sources (REQ-114/REQ-115), innermost
 *   first — e.g. an `ExpansionPath.sourceChain` from `expandStateTrigger`, or `[]` for a plain
 *   event-triggered transition.
 * @returns The ordered columns; empty when neither the transition nor this path's chain
 *   references any argument, in which case a plain `Scenario` is rendered (REQ-047).
 * @throws Error When a modifier argument has no base reference anywhere in the transition or this
 *   path's chain (REQ-136).
 */
export function collectPathExampleColumns(
    stateMachineName: string,
    defaultPreconditions: DefaultPrecondition[],
    transition: Transition,
    sourceChain: ExpansionSourceStep[],
): ExampleColumn[] {
    const groups = [
        ...argumentGroups(stateMachineName, transition, defaultPreconditions),
        ...sourceChain.flatMap((step) =>
            argumentGroups(step.stateMachineName, step.transition, step.defaultPreconditions),
        ),
    ]
    return buildExampleColumns(groups)
}


// --- Cell values ---

/**
 * Resolve the modifier-derived cell value of a column for one row.
 *
 * @param stateMachines All state machines, for looking up the declaring machine's example values.
 * @param stateMachineName Name of the state machine owning the transition being rendered, used as
 *   the pool machine only when `column.poolStateMachineName` is absent.
 * @param column Modifier column to evaluate.
 * @param row Row containing the source value.
 * @param sourceRowIndex Index of the row in the joined value table.
 * @returns The derived cell value.
 */
function resolveModifierValue(
    stateMachines: StateMachine[],
    stateMachineName: string,
    column: ExampleColumn,
    row: ExampleRow,
    sourceRowIndex: number,
    allRows: ExampleRow[],
): string {
    const poolStateMachineName = column.poolStateMachineName ?? stateMachineName
    return derivedModifierValue(
        stateMachines, poolStateMachineName, column.sourceName, column.modifier, row, sourceRowIndex,
        {
            sourceModifier: column.sourceModifier,
            sourceContext: column.sourceContext,
            transitionLabel: column.transitionLabel,
        },
    )
}

/**
 * Resolve the rendered cell value for any column kind from a single row.
 *
 * A reference-valued result column (REQ-423) normally resolves against this row's own raw value
 * for the referenced attribute. But when that attribute is itself produced elsewhere in this same
 * table by a state-trigger source's own result (i.e. a `resulting X` column exists for it), the
 * source's produced value is what the reference means — the raw base column instead holds that
 * attribute's *precondition* value (as filtered for the source's own `Given` state), a different
 * point in time. A transition whose trigger bare-references an attribute a matched expansion
 * source's result produces (REQ-118) is referring to the value the source produces, not to
 * whatever the attribute happened to hold beforehand, so the produced column takes precedence.
 *
 * @param stateMachines All state machines for looking up example values.
 * @param stateMachineName Name of the state machine owning the transition, for error context.
 * @param columns All columns of the table being rendered, so a reference-valued result column can
 *   look up whether the attribute it names is itself produced elsewhere in the same table.
 * @param column Column definition to evaluate.
 * @param row Row containing the source values.
 * @param sourceRowIndex Index of the row in the original table.
 * @param allRows Original example rows used for derived modifier values.
 * @returns The rendered cell value for the row and column.
 */
export function resolveCellValue(
    stateMachines: StateMachine[],
    stateMachineName: string,
    columns: ExampleColumn[],
    column: ExampleColumn,
    row: ExampleRow,
    sourceRowIndex: number,
    allRows: ExampleRow[],
): string {
    switch (column.kind) {
        case "base":
            return row[column.sourceName] ?? ""
        case "modifier":
            return resolveModifierValue(stateMachines, stateMachineName, column, row, sourceRowIndex, allRows)
        case "result": {
            if (!column.valueIsReference) return column.resultValue ?? ""
            const producedColumn = columns.find((candidate) =>
                candidate !== column && candidate.kind === "result" && candidate.sourceName === column.resultValue,
            )
            return producedColumn
                ? resolveCellValue(stateMachines, stateMachineName, columns, producedColumn, row, sourceRowIndex, allRows)
                : (row[column.resultValue ?? ""] ?? "")
        }
    }
}
