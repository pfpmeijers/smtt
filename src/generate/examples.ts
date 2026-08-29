import type { Argument, DefaultPrecondition, StateMachine, Transition } from "../parse"
import { canonicalModifier, DIFFERENT_MODIFIER, modifierColumnName, resultingColumnName } from "./arguments"
import { type FilterCondition, evaluateCondition, validateResultCondition } from "./conditions"

/** One row of example attribute values, keyed by attribute name. */
export type ExampleRow = Record<string, string>

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
 * Natural-join two row sets by their shared column names while keeping all columns from both sides.
 *
 * @param left Left-hand example rows.
 * @param right Right-hand example rows.
 * @returns The joined rows, preserving the left row order and right row iteration order.
 */
function naturalJoinRows(left: ExampleRow[], right: ExampleRow[]): ExampleRow[] {
    const sharedKeys = Object.keys(left[0] ?? {}).filter((key) => right[0] && key in right[0])
    const joinedRows: ExampleRow[] = []
    for (const leftRow of left) {
        for (const rightRow of right) {
            if (sharedKeys.every((key) => leftRow[key] === rightRow[key])) {
                joinedRows.push({ ...leftRow, ...rightRow })
            }
        }
    }
    return joinedRows
}

/**
 * Effective example value table of a transition: the `dataExampleValues` tables of all
 * contributing state machines, combined by natural join (REQ-068/REQ-161). State machines without
 * example values impose no constraint; the result is empty when none of them defines rows.
 *
 * @param stateMachines State machines available for lookup.
 * @param stateMachineNames Names of contributing state machines.
 * @returns The joined example rows.
 */
export function mergeExampleValues(
    stateMachines: StateMachine[],
    stateMachineNames: Iterable<string>,
): ExampleRow[] {
    const tables = [...stateMachineNames]
        .map((name) => stateMachines.find((stateMachine) => stateMachine.name === name)?.dataExampleValues ?? [])
        .filter((table) => table.length > 0)
    if (tables.length === 0) return []
    return tables.reduce((joined, table) => naturalJoinRows(joined, table))
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
    /** Fixed cell value of a `result-condition` column. */
    conditionValue?: string
}

/**
 * Collect the argument groups of a transition in the order they are scanned for example columns.
 *
 * @param transition Transition being inspected.
 * @param defaultPreconditions Default preconditions attached to the owning state machine.
 * @returns Argument groups in scan order, including result arguments flagged for result processing.
 */
function argumentGroups(
    transition: Transition,
    defaultPreconditions: DefaultPrecondition[],
): Array<{ args: Argument[]; isResult: boolean }> {
    return [
        ...defaultPreconditions.map((precondition) => ({ args: precondition.arguments ?? [], isResult: false })),
        ...(transition.states ?? []).map((stateRef) => ({ args: stateRef.arguments ?? [], isResult: false })),
        { args: transition.trigger.arguments ?? [], isResult: false },
        { args: transition.result.arguments ?? [], isResult: true },
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
 * @param argument Modifier argument to turn into a derived column.
 * @param baseReferenceNames Base attribute names referenced anywhere in the transition.
 * @returns The derived modifier column.
 * @throws Error When the transition holds no base references for the modified attribute (REQ-136).
 */
function modifierColumn(argument: Argument, baseReferenceNames: ReadonlySet<string>): ExampleColumn {
    if (!baseReferenceNames.has(argument.name)) {
        throw new Error(
            `Invalid modifier "${argument.modifier}" for attribute "${argument.name}": ` +
                `no base reference found in the transition`,
        )
    }
    return {
        kind: "modifier",
        name: modifierColumnName(argument) as string,
        sourceName: argument.name,
        modifier: canonicalModifier(argument),
    }
}

/**
 * Columns of the examples table of a transition: every referenced base attribute in
 * first-encounter order, followed by the derived modifier and result condition columns in
 * their encounter order (REQ-064/REQ-065/REQ-066/REQ-151/REQ-152).
 *
 * @param transition Transition whose examples columns are being collected.
 * @param defaultPreconditions Default preconditions of the owning state machine.
 * @returns The ordered columns; empty when the transition references no arguments at all,
 *   in which case a plain `Scenario` is rendered instead of a `Scenario Outline` (REQ-047).
 * @throws Error When a modifier argument has no base references in the transition (REQ-136),
 *   or when a result condition uses a non-equality operator (REQ-089).
 */
export function collectExampleColumns(
    transition: Transition,
    defaultPreconditions: DefaultPrecondition[],
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

    for (const { args, isResult } of groups) {
        for (const argument of args) {
            if (argument.modifier) {
                addDerived(modifierColumn(argument, baseReferenceNames))
            } else {
                addBase(argument.name)
            }
            if (isResult && argument.condition) {
                validateResultCondition(argument.condition, argument.name)
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
 * @param sourceValue Current attribute value in the source row.
 * @param modifier Modifier to apply.
 * @param attributeName Attribute being evaluated.
 * @returns The incremented or decremented value as a string.
 * @throws Error When the source value is not numeric.
 */
function steppedValue(sourceValue: string | undefined, modifier: string, attributeName: string): string {
    const numericValue = Number(sourceValue)
    if (Number.isNaN(numericValue)) {
        throw new Error(
            `Invalid modifier "${modifier}" for attribute "${attributeName}": ` +
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
 * @param attributeName Attribute to inspect.
 * @param currentValue Current value on the row under evaluation.
 * @param pool Candidate rows used to select a different value.
 * @returns The first different value found in the pool.
 * @throws Error When the pool holds fewer than two distinct values or no differing value exists.
 */
function differentValue(attributeName: string, currentValue: string, pool: ExampleRow[]): string {
    const distinctValues = new Set(pool.map((candidateRow) => candidateRow[attributeName] ?? ""))
    if (distinctValues.size < 2) {
        throw new Error(
            `Invalid modifier "different" for attribute "${attributeName}": ` +
                `expected at least two distinct values but found ${distinctValues.size}`,
        )
    }

    for (const candidateRow of pool) {
        const candidate = candidateRow[attributeName] ?? ""
        if (candidate !== currentValue) return candidate
    }
    throw new Error(
        `Invalid modifier "different" for attribute "${attributeName}": ` +
            `could not find a value different from ${JSON.stringify(currentValue)}`,
    )
}

/**
 * Resolve the value of a modifier column for one row.
 *
 * @param column Modifier column to evaluate.
 * @param row Row containing the source value.
 * @param sourceRowIndex Index of the row in the original value table.
 * @param allRows Original, unfiltered example rows used for positional modifiers.
 * @returns The derived cell value, or an empty string for unknown modifiers.
 * @throws Error When the modifier cannot be derived from the available values.
 */
function resolveModifierValue(
    column: ExampleColumn,
    row: ExampleRow,
    sourceRowIndex: number,
    allRows: ExampleRow[],
): string {
    const attributeName = column.sourceName
    const sourceValue = row[attributeName]
    switch (column.modifier) {
        case "incremented":
        case "decremented":
            return steppedValue(sourceValue, column.modifier, attributeName)
        case "first":
            return allRows[0]?.[attributeName] ?? ""
        case "last":
            return allRows[allRows.length - 1]?.[attributeName] ?? ""
        case "next":
            return shiftedValue(attributeName, sourceRowIndex, 1, allRows)
        case "previous":
            return shiftedValue(attributeName, sourceRowIndex, -1, allRows)
        case DIFFERENT_MODIFIER:
            return differentValue(attributeName, sourceValue ?? "", allRows)
        default:
            return ""
    }
}

/**
 * Resolve the rendered cell value for any column kind from a single row.
 *
 * @param column Column definition to evaluate.
 * @param row Row containing the source values.
 * @param sourceRowIndex Index of the row in the original table.
 * @param allRows Original example rows used for derived modifier values.
 * @returns The rendered cell value for the row and column.
 */
function resolveCellValue(
    column: ExampleColumn,
    row: ExampleRow,
    sourceRowIndex: number,
    allRows: ExampleRow[],
): string {
    switch (column.kind) {
        case "base":
            return row[column.sourceName] ?? ""
        case "modifier":
            return resolveModifierValue(column, row, sourceRowIndex, allRows)
        case "result-condition":
            return column.conditionValue ?? ""
    }
}

// --- Rows ---

/**
 * Keep the rows satisfying all filters (REQ-069/REQ-099). A filter carrying a modifier is
 * evaluated against the derived value rather than the base value (REQ-143/REQ-144).
 *
 * @param rows Rows to filter.
 * @param filters Filters to apply; no filters keep all rows.
 * @param allRows Original, unfiltered table used for positional modifier derivation.
 * @returns The surviving rows.
 */
export function filterRows(
    rows: ExampleRow[],
    filters: FilterCondition[],
    allRows: ExampleRow[],
): ExampleRow[] {
    const filteredRows = filters.length === 0
        ? rows
        : rows.filter((row, rowIndex) =>
            filters.every(({ sourceName, condition, modifier }) => {
                const value = modifier
                    ? resolveModifierValue(
                        { kind: "modifier", name: "", sourceName, modifier }, row, rowIndex, allRows)
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
 * @param columns Columns to render.
 * @param rows Surviving rows to render.
 * @param allRows Original, unfiltered table used for positional modifier derivation (REQ-158).
 * @returns The rendered `Examples:` block.
 */
export function formatExamplesTable(
    columns: ExampleColumn[],
    rows: ExampleRow[],
    allRows: ExampleRow[],
): string {
    const uniqueRows = deduplicateRows(rows)
    const rowCells = deduplicateRenderedRows(uniqueRows.map((row, rowIndex) => {
        const originalRowIndex = allRows.indexOf(row)
        const sourceRowIndex = originalRowIndex >= 0 ? originalRowIndex : rowIndex
        return columns.map((column) => resolveCellValue(column, row, sourceRowIndex, allRows))
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




