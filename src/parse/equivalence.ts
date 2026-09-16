/**
 * Equivalent example rows: which rows of an examples table exercise the same behaviour.
 *
 * A state machine tells values apart in three ways only: by a literal a condition or result names,
 * by equality with another value of the same row, and by order, pool position or arithmetic.
 * Renaming the values it tells apart by none of these is a symmetry of the model, so two rows that
 * map onto each other under such a renaming run the same scenario with different data, and one of
 * them suffices (REQ-440).
 */

import type { ExampleColumn } from "./examples"
import type { Argument, Condition, StateMachine } from "./sm.ast.d"

/** What makes a value significant to the model as a whole, rather than interchangeable. */
export interface DistinguishedValues {
    /** Literal values named by any condition or result, anywhere in the model. */
    literals: ReadonlySet<string>
    /** Attributes compared by order, range, pool position or arithmetic anywhere: never renamed. */
    concreteAttributes: ReadonlySet<string>
}

/** One row of a grouped table, with whether it is its group's representative. */
export interface GroupedRow {
    cells: string[]
    kept: boolean
}

const ORDERING_OPERATORS = new Set(["<", ">", "<=", ">=", "in range", "not in range"])
/** Modifiers deriving a value from arithmetic or from a position in the ordered pool. */
const ORDERED_MODIFIERS = new Set(["incremented", "decremented", "first", "last", "next", "previous"])

/**
 * Collect the literals and concrete attributes of every condition, implied condition and result
 * in the model (REQ-440).
 *
 * @param stateMachines All state machines.
 * @returns The values and attributes the model distinguishes.
 */
export function collectDistinguishedValues(stateMachines: StateMachine[]): DistinguishedValues {
    const literals = new Set<string>()
    const concreteAttributes = new Set<string>()

    const addCondition = (attribute: string, condition: Condition | undefined) => {
        if (!condition) return
        if (ORDERING_OPERATORS.has(condition.operator)) concreteAttributes.add(attribute)
        if (condition.valueIsReference) return
        const values = Array.isArray(condition.value) ? condition.value : [condition.value]
        for (const value of values) {
            if (typeof value === "string" && value !== "") literals.add(value)
        }
    }
    const addArguments = (args: Argument[] | undefined) => {
        for (const argument of args ?? []) {
            if (argument.modifier && ORDERED_MODIFIERS.has(argument.modifier)) concreteAttributes.add(argument.name)
            addCondition(argument.name, argument.condition as Condition | undefined)
            const result = argument.result
            if (result && !result.valueIsReference && result.value) literals.add(result.value)
        }
    }
    const addStateRef = (stateRef: { arguments?: Argument[] } | undefined) => addArguments(stateRef?.arguments)

    for (const stateMachine of stateMachines) {
        for (const state of stateMachine.states ?? []) {
            for (const implied of state.impliedConditions ?? []) addCondition(implied.attribute, implied.condition)
        }
        for (const precondition of stateMachine.defaultPreconditions ?? []) addArguments(precondition.arguments)
        const entries = [
            ...(stateMachine.transitions ?? []),
            ...(stateMachine.impossible?.defined ?? []),
            ...(stateMachine.irrelevant ?? []),
        ] as { states?: { arguments?: Argument[] }[]; trigger?: { arguments?: Argument[] }; result?: { arguments?: Argument[] } }[]
        for (const entry of entries) {
            for (const stateRef of entry.states ?? []) addStateRef(stateRef)
            addStateRef(entry.trigger)
            addStateRef(entry.result)
        }
    }
    return { literals, concreteAttributes }
}

/**
 * Attribute whose values a column's cells hold, or `undefined` when the cells are a fixed literal.
 *
 * @param column Column to inspect.
 * @returns The attribute name, or `undefined` for a literal result column.
 */
function columnAttribute(column: ExampleColumn): string | undefined {
    if (column.kind !== "result") return column.sourceName
    if (!column.valueIsReference) return undefined
    return column.boundColumn ? columnAttribute(column.boundColumn) : column.resultValue
}

/**
 * Canonical form of a rendered row (REQ-440): significant cells verbatim, every other value
 * replaced by the index of its first occurrence among the row's interchangeable values. The index
 * space is shared by all columns, so equalities between cells survive the renaming.
 *
 * @param cells Rendered cell values, one per column.
 * @param columns Columns the cells belong to.
 * @param distinguished Values and attributes the model distinguishes.
 * @returns A signature equal for exactly the rows that are renamings of each other.
 */
export function rowSignature(cells: string[], columns: ExampleColumn[], distinguished: DistinguishedValues): string {
    const symbols = new Map<string, number>()
    return cells.map((cell, index) => {
        const attribute = columnAttribute(columns[index])
        const isSignificant = cell === ""
            || attribute === undefined
            || distinguished.concreteAttributes.has(attribute)
            || distinguished.literals.has(cell)
        if (isSignificant) return `=${cell}`
        if (!symbols.has(cell)) symbols.set(cell, symbols.size)
        return `$${symbols.get(cell)}`
    }).join("")
}

/**
 * Group rendered rows into equivalence classes (REQ-440): classes in order of first occurrence,
 * rows within a class in table order, the first row of each class kept.
 *
 * @param rows Rendered, de-duplicated rows.
 * @param columns Columns the cells belong to.
 * @param distinguished Values and attributes the model distinguishes.
 * @returns The classes.
 */
export function groupEquivalentRows(
    rows: string[][],
    columns: ExampleColumn[],
    distinguished: DistinguishedValues,
): GroupedRow[][] {
    const groups = new Map<string, GroupedRow[]>()
    for (const cells of rows) {
        const signature = rowSignature(cells, columns, distinguished)
        const group = groups.get(signature)
        if (group) group.push({ cells, kept: false })
        else groups.set(signature, [{ cells, kept: true }])
    }
    return [...groups.values()]
}

/**
 * Drop every row equivalent to an earlier one (REQ-440).
 *
 * @param rows Rendered, de-duplicated rows.
 * @param columns Columns the cells belong to.
 * @param distinguished Values and attributes the model distinguishes.
 * @returns The representative rows, in table order.
 */
export function pruneEquivalentRows(
    rows: string[][],
    columns: ExampleColumn[],
    distinguished: DistinguishedValues,
): string[][] {
    const seen = new Set<string>()
    return rows.filter((cells) => {
        const signature = rowSignature(cells, columns, distinguished)
        if (seen.has(signature)) return false
        seen.add(signature)
        return true
    })
}
