import * as fs from "fs"
import * as path from "path"
import { parse } from "../parse"

type TransitionTarget = {
    id: string
}

/**
 * Parses a Markdown table row into individual cell values.
 *
 * Splits by pipe characters and removes leading/trailing pipes, then
 * trims whitespace from each cell.
 *
 * @param lineText A Markdown table row (e.g., `| cell1 | cell2 |`).
 * @returns Array of trimmed cell values.
 */
function parseTableCells(lineText: string): string[] {
    const rawCells = lineText.split("|")
    const cells = [...rawCells]

    if (lineText.trimStart().startsWith("|")) {
        cells.shift()
    }
    if (lineText.trimEnd().endsWith("|")) {
        cells.pop()
    }

    return cells.map(cell => cell.trim())
}

/**
 * Formats an array of cell values as a Markdown table row.
 *
 * @param cells Array of cell values.
 * @returns Formatted Markdown table row string.
 */
function formatTableRow(cells: string[]): string {
    return `| ${cells.join(" | ")} |`
}

/**
 * Ensures the cell array starts with a "#" column.
 *
 * If the first cell is not "#", prepends it to the array.
 *
 * @param cells Array of cell values.
 * @returns Cell array with "#" column ensured.
 */
function withHashColumn(cells: string[]): string[] {
    return cells[0] === "#" ? cells : ["#", ...cells]
}

/**
 * Finds the transition rules table line indexes.
 *
 * @param stateMachineName Name of the state machine owning the file, for error context.
 * @param lines File lines array.
 * @returns Header, separator, and transition row line indexes.
 * @throws Error if the rules table header or separator cannot be found.
 */
function findTransitionTableLineIndexes(stateMachineName: string, lines: string[]): {
    headerLineIndex: number
    separatorLineIndex: number
    rowLineIndexes: number[]
} {
    let rulesHeadingLineIndex = -1
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        if (lines[lineIndex].trim() === "### Rules") {
            rulesHeadingLineIndex = lineIndex
            break
        }
    }

    if (rulesHeadingLineIndex === -1) {
        throw new Error(`State machine \`${stateMachineName}\`: Could not find transitions rules heading.`)
    }

    let headerLineIndex = -1
    let separatorLineIndex = -1
    const rowLineIndexes: number[] = []

    for (let lineIndex = rulesHeadingLineIndex + 1; lineIndex < lines.length; lineIndex++) {
        const lineText = lines[lineIndex].trim()

        if (lineText.length === 0) {
            if (headerLineIndex !== -1 && separatorLineIndex !== -1 && rowLineIndexes.length > 0) {
                break
            }
            continue
        }

        const isTableRow = lineText.startsWith("|") && lineText.endsWith("|")
        if (!isTableRow) {
            if (headerLineIndex !== -1 && separatorLineIndex !== -1 && rowLineIndexes.length > 0) {
                break
            }
            continue
        }

        if (headerLineIndex === -1) {
            headerLineIndex = lineIndex
            continue
        }

        if (separatorLineIndex === -1) {
            separatorLineIndex = lineIndex
            continue
        }

        rowLineIndexes.push(lineIndex)
    }

    if (headerLineIndex === -1 || separatorLineIndex === -1) {
        throw new Error(`State machine \`${stateMachineName}\`: Could not find transitions table header.`)
    }

    return { headerLineIndex, separatorLineIndex, rowLineIndexes }
}

/**
 * Ensures the transitions table has a leading `#` column.
 *
 * @param lines File lines array (modified in place if needed).
 * @param headerLineIndex Header row line index.
 * @param separatorLineIndex Separator row line index.
 * @returns Object with `hasHashColumn` flag indicating if the original header already had a `#` column.
 */
function ensureHashColumn(
    lines: string[],
    headerLineIndex: number,
    separatorLineIndex: number,
): { hasHashColumn: boolean } {

    const headerCells = parseTableCells(lines[headerLineIndex])
    const hasHashColumn = headerCells[0] === "#"

    if (!hasHashColumn) {
        lines[headerLineIndex] = formatTableRow(withHashColumn(headerCells))

        const separatorCells = parseTableCells(lines[separatorLineIndex])
        const normalizedSeparatorCells = withHashColumn(separatorCells).map(() => "---")
        lines[separatorLineIndex] = formatTableRow(normalizedSeparatorCells)
    }

    return { hasHashColumn }
}

/**
 * Rewrites transition rows in a single source file with deterministic IDs.
 *
 * Reads the file, parses transition table rows, updates their ID column with
 * the provided transition IDs in order, and writes the modified content back.
 *
 * @param stateMachineName Name of the state machine owning the file, for error context.
 * @param sourceFilePath Path to the state machine file to modify.
 * @param transitions Sorted array of transitions with their target IDs.
 */
function renumberFile(stateMachineName: string, sourceFilePath: string, transitions: TransitionTarget[]): void {
    if (transitions.length === 0) {
        return
    }

    const content = fs.readFileSync(sourceFilePath, "utf8")
    const lines = content.split(/\r?\n/)

    const { headerLineIndex, separatorLineIndex, rowLineIndexes } = findTransitionTableLineIndexes(stateMachineName, lines)

    if (rowLineIndexes.length < transitions.length) {
        throw new Error(
            `State machine \`${stateMachineName}\`: Could not renumber all transitions in ` +
                `\`${sourceFilePath}\`. Expected at least \`${transitions.length}\` rule rows but found ` +
                `\`${rowLineIndexes.length}\`.`,
        )
    }

    const { hasHashColumn } = ensureHashColumn(lines, headerLineIndex, separatorLineIndex)

    for (let transitionIndex = 0; transitionIndex < transitions.length; transitionIndex++) {
        const transition = transitions[transitionIndex]
        const lineIndex = rowLineIndexes[transitionIndex]
        const lineText = lines[lineIndex]
        const cells = parseTableCells(lineText)

        if (hasHashColumn) {
            if (cells.length === 0) {
                continue
            }
            cells[0] = transition.id
            lines[lineIndex] = formatTableRow(cells)
            continue
        }

        lines[lineIndex] = formatTableRow([transition.id, ...cells])
    }

    fs.writeFileSync(sourceFilePath, lines.join("\n"), "utf8")
}

/**
 * Renumbers all transition rows across all parsed state machine files.
 *
 * Collects all transitions from all state machines, sorts them globally by
 * file path then line number, assigns deterministic IDs (001, 002, etc.),
 * and rewrites each file's transitions with these IDs.
 *
 * @param inputDir Directory containing state machine files to process.
 */
export function renumber(inputDir: string): void {
    const stateMachines = parse(inputDir)
    const transitionsByFile = new Map<string, TransitionTarget[]>()
    const numberedTransitions: { sourceFilePath: string }[] = []
    const stateMachineNameByFile = new Map<string, string>()

    for (const stateMachine of stateMachines) {
        if (!stateMachine.source) {
            continue
        }

        const sourceFilePath = path.resolve(stateMachine.source)
        const transitions = stateMachine.transitions ?? []
        stateMachineNameByFile.set(sourceFilePath, stateMachine.name)

        for (const _transition of transitions) {
            numberedTransitions.push({ sourceFilePath })
        }
    }

    numberedTransitions.sort((firstTransition, secondTransition) => {
        return firstTransition.sourceFilePath.localeCompare(secondTransition.sourceFilePath)
    })

    const numberWidth = Math.max(3, String(numberedTransitions.length).length)

    numberedTransitions.forEach((transition, transitionIndex) => {
        const id = String(transitionIndex + 1).padStart(numberWidth, "0")
        const fileTargets = transitionsByFile.get(transition.sourceFilePath) ?? []
        fileTargets.push({ id })
        transitionsByFile.set(transition.sourceFilePath, fileTargets)
    })

    for (const [sourceFilePath, transitions] of transitionsByFile.entries()) {
        renumberFile(stateMachineNameByFile.get(sourceFilePath) ?? "<unknown>", sourceFilePath, transitions)
    }
}


