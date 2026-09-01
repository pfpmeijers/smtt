import type { Argument, DefaultPrecondition, StateMachine, Transition } from "../parse"
import { canonicalModifier, DIFFERENT_MODIFIER, modifierColumnName, resultingColumnName } from "./arguments"
import { type FilterCondition, evaluateCondition, validateResultCondition } from "./conditions"

/** One row of example attribute values, keyed by attribute name. */
export type ExampleRow = Record<string, string>

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
 */
function deduplicateRenderedRows(cells: string[][]): string[][] {
    const seen = new Set<string>()
    const uniqueCells: string[][] = []
    for (const row of cells) {
        const signature = row.join("\u0001")
        if (seen.has(signature)) continue
        seen.add(signature)
        uniqueCells.push(row)
    }
    return uniqueCells
}

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
 * Effective example value table of a transition: the owning state machine's own `dataExampleValues`
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
        .map((name) => stateMachines.find((stateMachine) => stateMachine.name === name)?.dataExampleValues ?? [])
        .filter((table) => table.length > 0)
    if (tables.length === 0) return []
    return tables.reduce((accumulated, table) => mergeInNewColumns(accumulated, table))
}

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
        ? "the state machine's dataExampleValues table is empty or absent"
        : `the dataExampleValues tables of state machines ${names.map((name) => `\`${name}\``).join(", ")} are empty or absent`
}


// --- Columns ---

/** Column kinds of an examples table: a plain attribute, a modifier derivation, a result value. */
type ColumnKind = "base" | "modifier" | "result-condition"

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
    /** Fixed cell value of a `result-condition` column. */
    conditionValue?: string
}

/**
 * Collect the argument groups of a transition in the order they are scanned for example columns.
 * Each group carries a human-readable `source` label (e.g. `` state `X` `` or `` result `X` ``)
 * identifying which precondition, trigger, or result the group's arguments were declared on, for
 * use in error messages.
 *
 * @param transition Transition being inspected.
 * @param defaultPreconditions Default preconditions attached to the owning state machine.
 * @returns Argument groups in scan order, including result arguments flagged for result processing.
 */
function argumentGroups(
    transition: Transition,
    defaultPreconditions: DefaultPrecondition[],
): Array<{ args: Argument[]; isResult: boolean; source: string }> {
    return [
        ...defaultPreconditions.map((precondition) => ({
            args: precondition.arguments ?? [], isResult: false, source: `default precondition \`${precondition.state}\``,
        })),
        ...(transition.states ?? []).map((stateRef) => ({
            args: stateRef.arguments ?? [], isResult: false, source: `state \`${stateRef.name}\``,
        })),
        { args: transition.trigger.arguments ?? [], isResult: false, source: `trigger \`${transition.trigger.name}\`` },
        { args: transition.result.arguments ?? [], isResult: true, source: `result \`${transition.result.name}\`` },
    ]
}

/**
 * Read the fixed value carried by a result-condition argument.
 *
 * @param argument Result argument whose condition value should be extracted.
 * @returns The first condition value, or an empty string when no fixed value is present.
 */
function resultConditionValue(argument: Argument): string {
    const value = argument.condition?.value
    return (Array.isArray(value) ? value[0] : value) ?? ""
}

/**
 * Derived column of a modifier argument (REQ-076).
 *
 * @param stateMachineName Name of the state machine owning the transition, for error context.
 * @param argument Modifier argument to turn into a derived column.
 * @param source Human-readable label of the precondition/trigger/result the argument was declared on.
 * @param transition Transition the argument belongs to, for error context.
 * @param baseReferenceNames Base attribute names referenced anywhere in the transition.
 * @returns The derived modifier column.
 * @throws Error When the transition holds no base references for the modified attribute (REQ-136).
 */
function modifierColumn(
    stateMachineName: string,
    argument: Argument,
    source: string,
    transition: Transition,
    baseReferenceNames: ReadonlySet<string>,
): ExampleColumn {
    const transitionLabel = transitionDescription(transition)
    if (!baseReferenceNames.has(argument.name)) {
        throw new Error(
            `State machine \`${stateMachineName}\`: ${transitionLabel}: Invalid modifier \`${argument.modifier}\` ` +
                `for attribute \`${argument.name}\` on ${source}: no base reference found in the transition`,
        )
    }
    return {
        kind: "modifier",
        name: modifierColumnName(argument) as string,
        sourceName: argument.name,
        modifier: canonicalModifier(argument),
        sourceModifier: argument.modifier,
        sourceContext: source,
        transitionLabel,
    }
}

/**
 * Columns of the examples table of a transition: every referenced base attribute in
 * first-encounter order, followed by the derived modifier and result condition columns in
 * their encounter order (REQ-064/REQ-065/REQ-066/REQ-151/REQ-152).
 *
 * @param stateMachineName Name of the state machine owning the transition, for error context.
 * @param defaultPreconditions Default preconditions of the owning state machine.
 * @param transition Transition whose examples columns are being collected.
 * @returns The ordered columns; empty when the transition references no arguments at all,
 *   in which case a plain `Scenario` is rendered instead of a `Scenario Outline` (REQ-047).
 * @throws Error When a modifier argument has no base references in the transition (REQ-136),
 *   or when a result condition uses a non-equality operator (REQ-089).
 */
export function collectExampleColumns(
    stateMachineName: string,
    defaultPreconditions: DefaultPrecondition[],
    transition: Transition,
): ExampleColumn[] {
    const groups = argumentGroups(transition, defaultPreconditions)
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

    for (const { args, isResult, source } of groups) {
        for (const argument of args) {
            if (argument.modifier) {
                addDerived(modifierColumn(stateMachineName, argument, source, transition, baseReferenceNames))
            } else {
                addBase(argument.name)
            }
            if (isResult && argument.condition) {
                validateResultCondition(stateMachineName, argument.name, argument.condition)
                addDerived({
                    kind: "result-condition",
                    name: resultingColumnName(argument.name),
                    sourceName: argument.name,
                    conditionValue: resultConditionValue(argument),
                })
            }
        }
    }
    return [...baseColumns, ...derivedColumns]
}


// --- Cell values ---

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
 * Find the first distinct value in the source table that differs from the current row.
 *
 * @param stateMachineName Name of the state machine owning the transition, for error context.
 * @param attributeName Attribute to inspect.
 * @param currentValue Current value on the row under evaluation.
 * @param pool Candidate rows used to select a different value.
 * @param sourceModifier Original modifier text, for error reporting.
 * @param sourceContext Human-readable label of the precondition/trigger/result the modifier was declared on.
 * @param transitionLabel Label of the owning transition, for error context.
 * @returns The first different value found in the pool.
 * @throws Error When the pool holds fewer than two distinct values or no differing value exists.
 */
function differentValue(
    stateMachineName: string,
    attributeName: string,
    currentValue: string,
    pool: ExampleRow[],
    sourceModifier?: string,
    sourceContext?: string,
    transitionLabel?: string,
): string {
    const distinctValues = new Set(pool.map((candidateRow) => candidateRow[attributeName] ?? ""))
    if (distinctValues.size < 2) {
        const found = [...distinctValues].map((value) => value === "" ? "<undefined>" : `\`${value}\``).join(", ")
        throw new Error(
            `State machine \`${stateMachineName}\`: ${transitionLabel ?? "Anonymous transition"}: ` +
                `Invalid modifier \`${sourceModifier ?? "different"}\` for attribute \`${attributeName}\` ` +
                `on ${sourceContext ?? "unknown source"}: expected at least two distinct values but found ` +
                `${distinctValues.size} (${found})`,
        )
    }

    for (const candidateRow of pool) {
        const candidate = candidateRow[attributeName] ?? ""
        if (candidate !== currentValue) return candidate
    }
    throw new Error(
        `State machine \`${stateMachineName}\`: ${transitionLabel ?? "Anonymous transition"}: ` +
            `Invalid modifier \`${sourceModifier ?? "different"}\` for attribute \`${attributeName}\` ` +
            `on ${sourceContext ?? "unknown source"}: could not find a value different from ${JSON.stringify(currentValue)}`,
    )
}

/**
 * Resolve the value of a modifier column for one row. Modifiers are resolved against the
 * owning state machine's own example values table only, not the cross-machine joined table used
 * for base columns — a state machine must be sufficiently specified stand-alone.
 *
 * @param stateMachines All state machines, to look up the owning state machine's own example values.
 * @param stateMachineName Name of the state machine owning the transition, for error context.
 * @param column Modifier column to evaluate.
 * @param row Row containing the source value.
 * @param sourceRowIndex Index of the row in the original, joined value table (fallback only).
 * @param allRows Original, unfiltered, cross-machine joined example rows (unused by modifiers themselves).
 * @returns The derived cell value, or an empty string for unknown modifiers.
 * @throws Error When the owning state machine defines no example values, or when the modifier
 *   cannot otherwise be derived from the available values.
 */
function resolveModifierValue(
    stateMachines: StateMachine[],
    stateMachineName: string,
    column: ExampleColumn,
    row: ExampleRow,
    sourceRowIndex: number,
    allRows: ExampleRow[],
): string {
    const attributeName = column.sourceName
    const sourceValue = row[attributeName]

    // Modifiers resolve against the owning state machine's own example values only (a state
    // machine must be sufficiently specified stand-alone).
    const pool = stateMachines.find((stateMachine) => stateMachine.name === stateMachineName)?.dataExampleValues ?? []
    if (pool.length === 0) {
        throw new Error(
            `State machine \`${stateMachineName}\`: ${column.transitionLabel ?? "Anonymous transition"}: ` +
                `Invalid modifier \`${column.sourceModifier ?? column.modifier}\` for attribute \`${attributeName}\` ` +
                `on ${column.sourceContext ?? "unknown source"}: state machine defines no example values of its own`,
        )
    }
    const poolRowIndex = pool.findIndex((candidateRow) => (candidateRow[attributeName] ?? "") === (sourceValue ?? ""))
    const effectiveRowIndex = poolRowIndex >= 0 ? poolRowIndex : sourceRowIndex

    switch (column.modifier) {
        case "incremented":
        case "decremented":
            return steppedValue(
                stateMachineName, sourceValue, column.modifier, attributeName, column.sourceContext, column.transitionLabel,
            )
        case "first":
            return pool[0]?.[attributeName] ?? ""
        case "last":
            return pool[pool.length - 1]?.[attributeName] ?? ""
        case "next":
            return shiftedValue(attributeName, effectiveRowIndex, 1, pool)
        case "previous":
            return shiftedValue(attributeName, effectiveRowIndex, -1, pool)
        case DIFFERENT_MODIFIER:
            return differentValue(
                stateMachineName, attributeName, sourceValue ?? "", pool,
                column.sourceModifier, column.sourceContext, column.transitionLabel,
            )
        default:
            return ""
    }
}

/**
 * Resolve the rendered cell value for any column kind from a single row.
 *
 * @param stateMachines All state machines for looking up example values.
 * @param stateMachineName Name of the state machine owning the transition, for error context.
 * @param column Column definition to evaluate.
 * @param row Row containing the source values.
 * @param sourceRowIndex Index of the row in the original table.
 * @param allRows Original example rows used for derived modifier values.
 * @returns The rendered cell value for the row and column.
 */
function resolveCellValue(
    stateMachines: StateMachine[],
    stateMachineName: string,
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
        case "result-condition":
            return column.conditionValue ?? ""
    }
}

// --- Rows ---

/**
 * Keep the rows satisfying all filters (REQ-069/REQ-099). A filter carrying a modifier is
 * evaluated against the derived value rather than the base value (REQ-143/REQ-144).
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
                    ? resolveModifierValue(
                        stateMachines, stateMachineName, { kind: "modifier", name: "", sourceName, modifier, sourceModifier }, row, rowIndex, allRows)
                    : row[sourceName]
                return evaluateCondition(value, condition)
            }),
        )
    return deduplicateRows(filteredRows)
}

// --- Rendering ---

/**
 * Format one rendered examples-table row with the correct padding and indentation.
 *
 * @param cells Cell values to render in order.
 * @param widths Column widths used for padding.
 * @returns A single formatted table row string.
 */
function formatTableRow(cells: string[], widths: number[]): string {
    return `      |${cells.map((cell, index) => ` ${cell.padEnd(widths[index])} `).join("|")}|`
}

/**
 * Render the `Examples:` block of a scenario outline (REQ-063/REQ-125/REQ-126/REQ-130).
 *
 * @param stateMachines All state machines for looking up example values.
 * @param stateMachineName Name of the state machine owning the transition, for error context.
 * @param columns Columns to render.
 * @param rows Surviving rows to render.
 * @param allRows Original, unfiltered table used for positional modifier derivation (REQ-158).
 * @returns The rendered `Examples:` block.
 */
export function formatExamplesTable(
    stateMachines: StateMachine[],
    stateMachineName: string,
    columns: ExampleColumn[],
    rows: ExampleRow[],
    allRows: ExampleRow[],
): string {
    const uniqueRows = deduplicateRows(rows)
    const rowCells = deduplicateRenderedRows(uniqueRows.map((row, rowIndex) => {
        const originalRowIndex = allRows.indexOf(row)
        const sourceRowIndex = originalRowIndex >= 0 ? originalRowIndex : rowIndex
        return columns.map((column) => resolveCellValue(stateMachines, stateMachineName, column, row, sourceRowIndex, allRows))
    }))

    const headerCells = columns.map((column) => column.name)
    const widths = headerCells.map((header, columnIndex) =>
        Math.max(header.length, ...rowCells.map((cells) => (cells[columnIndex] ?? "").length)),
    )

    return [
        "    Examples:",
        formatTableRow(headerCells, widths),
        ...rowCells.map((cells) => formatTableRow(cells, widths)),
    ].join("\n")
}




