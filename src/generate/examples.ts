import type { Argument, DefaultPrecondition, StateMachine, Transition } from "../parse"
import {
    deduplicateRows,
    mergeExampleValues,
    resolveCellValue,
    type ExampleColumn,
    type ExampleRow,
} from "../parse"

// Re-exported so the generator keeps one import site for examples handling: the table itself is
// the parse step's, the `Examples:` block rendering below is this module's.
export { mergeExampleValues }
export type { ExampleRow }

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
        return columns.map((column) => resolveCellValue(stateMachines, stateMachineName, columns, column, row, sourceRowIndex, allRows))
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




