import type { Argument, DefaultPrecondition, StateMachine, Transition } from "../parse"
import { canonicalModifier, DIFFERENT_MODIFIER, modifierColumnName, resultingColumnName } from "./arguments"
import { type FilterCondition, evaluateCondition, validateResultCondition } from "./conditions"

/** One row of example attribute values, keyed by attribute name. */
export type ExampleRow = Record<string, string>

// --- Value tables ---

/** Natural join of two row sets: intersect on shared column values, union the columns. */
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

/**
 * Effective alternate value pool: the `dataOtherValues` rows of all contributing state machines
 * (REQ-071).
 *
 * @param stateMachines State machines available for lookup.
 * @param stateMachineNames Names of contributing state machines.
 * @returns The concatenated alternate value rows.
 */
export function mergeOtherValues(
    stateMachines: StateMachine[],
    stateMachineNames: Iterable<string>,
): ExampleRow[] {
    return [...stateMachineNames].flatMap(
        (name) => stateMachines.find((stateMachine) => stateMachine.name === name)?.dataOtherValues ?? [],
    )
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

/** Argument lists of a transition in examples column scan order (REQ-064). */
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

/** Fixed cell value of a result condition column, taken directly from the condition (REQ-089). */
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

/** Numeric derivation of the `incremented` / `decremented` modifiers (REQ-077/REQ-079). */
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

/** Circular row shift used by the `next` / `previous` modifiers (REQ-081/REQ-158). */
function shiftedValue(attributeName: string, rowIndex: number, shift: number, rows: ExampleRow[]): string {
    if (rows.length === 0) return ""
    const shiftedIndex = ((rowIndex + shift) % rows.length + rows.length) % rows.length
    return rows[shiftedIndex][attributeName] ?? ""
}

/**
 * Next-row-circular value that differs from the row's own value, taken from the example values
 * followed by the other values (REQ-083/REQ-084).
 *
 * @throws Error When the pool holds fewer than two distinct values (REQ-141), or when no
 *   differing value can be found.
 */
function differentValue(attributeName: string, currentValue: string, rowIndex: number, pool: ExampleRow[]): string {
    const distinctValues = new Set(pool.map((candidateRow) => candidateRow[attributeName] ?? ""))
    if (distinctValues.size < 2) {
        throw new Error(
            `Invalid modifier "different" for attribute "${attributeName}": ` +
                `expected at least two distinct values but found ${distinctValues.size}`,
        )
    }

    const startIndex = ((rowIndex + 1) % pool.length + pool.length) % pool.length
    for (let step = 0; step < pool.length; step++) {
        const candidate = pool[(startIndex + step) % pool.length][attributeName] ?? ""
        if (candidate !== currentValue) return candidate
    }
    throw new Error(
        `Invalid modifier "different" for attribute "${attributeName}": ` +
            `could not find a value different from ${JSON.stringify(currentValue)}`,
    )
}

/**
 * Cell value of a modifier column for one row (REQ-070). Positional modifiers derive from the
 * original, unfiltered example values table (REQ-158).
 *
 * @param column Modifier column to derive a value for.
 * @param row Row to derive the value from.
 * @param sourceRowIndex Index of the row within `allRows`.
 * @param allRows Original, unfiltered example values table.
 * @param otherRows Alternate value pool used by the `different` modifier.
 * @returns The derived value; `""` for an unknown modifier.
 * @throws Error When the modifier cannot be derived from the available values.
 */
function resolveModifierValue(
    column: ExampleColumn,
    row: ExampleRow,
    sourceRowIndex: number,
    allRows: ExampleRow[],
    otherRows: ExampleRow[],
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
            return differentValue(attributeName, sourceValue ?? "", sourceRowIndex, [...allRows, ...otherRows])
        default:
            return ""
    }
}

/**
 * Cell value of any column kind for one row.
 *
 * @param column Column to resolve.
 * @param row Row to read values from.
 * @param sourceRowIndex Row index within the original table.
 * @param allRows Original example rows.
 * @param otherRows Alternate example rows.
 * @returns The rendered cell value.
 */
function resolveCellValue(
    column: ExampleColumn,
    row: ExampleRow,
    sourceRowIndex: number,
    allRows: ExampleRow[],
    otherRows: ExampleRow[],
): string {
    switch (column.kind) {
        case "base":
            return row[column.sourceName] ?? ""
        case "modifier":
            return resolveModifierValue(column, row, sourceRowIndex, allRows, otherRows)
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
 * @param otherRows Alternate value pool used by the `different` modifier.
 * @returns The surviving rows.
 */
export function filterRows(
    rows: ExampleRow[],
    filters: FilterCondition[],
    allRows: ExampleRow[],
    otherRows: ExampleRow[],
): ExampleRow[] {
    if (filters.length === 0) return rows
    return rows.filter((row, rowIndex) =>
        filters.every(({ sourceName, condition, modifier }) => {
            const value = modifier
                ? resolveModifierValue(
                    { kind: "modifier", name: "", sourceName, modifier }, row, rowIndex, allRows, otherRows)
                : row[sourceName]
            return evaluateCondition(value, condition)
        }),
    )
}

// --- Rendering ---

/** Render one examples table row, padded to the column widths and indented per REQ-126. */
function formatTableRow(cells: string[], widths: number[]): string {
    return `      |${cells.map((cell, index) => ` ${cell.padEnd(widths[index])} `).join("|")}|`
}

/**
 * Render the `Examples:` block of a scenario outline (REQ-063/REQ-125/REQ-126/REQ-130).
 *
 * @param columns Columns to render.
 * @param rows Surviving rows to render.
 * @param allRows Original, unfiltered table used for positional modifier derivation (REQ-158).
 * @param otherRows Alternate value pool used by the `different` modifier.
 * @returns The rendered `Examples:` block.
 */
export function formatExamplesTable(
    columns: ExampleColumn[],
    rows: ExampleRow[],
    allRows: ExampleRow[],
    otherRows: ExampleRow[],
): string {
    const rowCells = rows.map((row, rowIndex) => {
        const originalRowIndex = allRows.indexOf(row)
        const sourceRowIndex = originalRowIndex >= 0 ? originalRowIndex : rowIndex
        return columns.map((column) => resolveCellValue(column, row, sourceRowIndex, allRows, otherRows))
    })

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




