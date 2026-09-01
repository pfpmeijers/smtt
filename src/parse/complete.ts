/**
 * AST completion step.
 *
 * Reads a parsed (and trigger-classified) AST that may be partially defined
 * and mutates it in place so that the rigid `validateStateMachines` pass can
 * succeed without requiring the author to declare every attribute explicitly.
 *
 * Operations performed for each state machine, in order:
 *  - Infer data attributes from every usage site (example-value table columns,
 *    implied conditions, default-precondition / transition arguments).
 *  - Synthesise a single all-undefined row when `dataExampleValues` is empty.
 *  - Augment `dataExampleValues` so that every condition-referenced value
 *    combination is satisfied by at least one row.
 */

import type { Argument, Condition, StateMachine } from "./sm.ast.d"

// --- Shared helpers ---

/**
 * Extracts all literal values referenced by a condition expression.
 * Mirrors the same helper in `validate.ts` so that both steps treat
 * conditions identically.
 *
 * @param condition Condition expression to extract values from.
 * @returns Array of literal string values referenced by the condition.
 *   Returns `[]` for `"undefined"` operators or absent values.
 *   For `"in"` operators, returns all listed values.
 *   For `"in range"` / `"not in range"` operators, returns the two boundary values.
 *   For all other operators, returns a single-element array with the value as a string.
 */
function extractConditionValues(condition: Condition): string[] {
    if (condition.operator === "undefined" || condition.value === undefined) {
        return []
    }
    if (Array.isArray(condition.value)) {
        return condition.value.map(String)
    }
    if (typeof condition.value === "string") {
        if (condition.operator === "in range" || condition.operator === "not in range") {
            const match = condition.value.match(/^\s*[\[(]\s*([^,\s]+)\s*,\s*([^,\s]+)\s*[\])]\s*$/)
            if (match) {
                return [match[1], match[2]]
            }
        }
        return [condition.value]
    }
    return [String(condition.value)]
}

/**
 * Returns the de-duplicated attribute names referenced by a list of
 * argument entries (each argument's `.name`, lower-cased).
 *
 * @param args List of arguments to scan.
 * @returns De-duplicated, lower-cased attribute names in iteration order.
 */
function attributeNamesFromArguments(args: Argument[]): string[] {
    return [...new Set(args.map((arg) => arg.name.toLowerCase()))]
}

// --- Infer data attributes ---

/**
 * Collects every attribute name referenced anywhere in the state machine:
 * - Column names in the existing `dataExampleValues` table.
 * - `implied.attribute` from state implied conditions.
 * - `argument.name` from default-precondition arguments, transition state
 *   arguments, trigger arguments, and result arguments.
 *
 * @param stateMachine State machine to scan.
 * @returns Sorted, de-duplicated set of lower-cased attribute names.
 */
function collectUsedAttributeNames(stateMachine: StateMachine): string[] {
    const names = new Set<string>()

    // Example-value table column names.
    for (const row of stateMachine.dataExampleValues ?? []) {
        for (const key of Object.keys(row)) {
            names.add(key.toLowerCase())
        }
    }

    // State implied conditions.
    for (const state of stateMachine.states) {
        for (const implied of state.impliedConditions ?? []) {
            names.add(implied.attribute.toLowerCase())
        }
    }

    // Default-precondition arguments.
    for (const precondition of stateMachine.defaultPreconditions ?? []) {
        for (const name of attributeNamesFromArguments(precondition.arguments ?? [])) {
            names.add(name)
        }
    }

    // Transition arguments (precondition states, trigger, result).
    // State trigger arguments are intentionally excluded here — they belong to the
    // machine that owns the trigger state, not to the current machine. Only event trigger
    // arguments (and result arguments) are part of this machine's own attribute space.
    for (const transition of stateMachine.transitions ?? []) {
        for (const stateRef of transition.states ?? []) {
            for (const name of attributeNamesFromArguments(stateRef.arguments ?? [])) {
                names.add(name)
            }
        }
        if (transition.trigger.type === "event") {
            for (const name of attributeNamesFromArguments(transition.trigger.arguments ?? [])) {
                names.add(name)
            }
        }
        for (const name of attributeNamesFromArguments(transition.result.arguments ?? [])) {
            names.add(name)
        }
    }

    return [...names].sort()
}

/**
 * [REQ-419] Ensures `stateMachine.data` contains an entry for every attribute
 * referenced anywhere in the machine. Inferred entries use `""` as their
 * description. Existing entries are left unchanged.
 *
 * @param stateMachine State machine to mutate.
 */
function inferDataAttributes(stateMachine: StateMachine): void {
    if (!stateMachine.data) {
        stateMachine.data = {}
    }
    for (const name of collectUsedAttributeNames(stateMachine)) {
        if (!(name in stateMachine.data)) {
            stateMachine.data[name] = ""
        }
    }
}

// --- Synthesise undefined rows ---

/**
 * Returns the sorted list of attribute names declared in `stateMachine.data`.
 *
 * @param stateMachine State machine whose `data` map is read.
 * @returns Alphabetically sorted attribute names, or `[]` when `data` is absent.
 */
function sortedDataAttributes(stateMachine: StateMachine): string[] {
    return Object.keys(stateMachine.data ?? {}).sort()
}

/**
 * [REQ-420] Ensures `dataExampleValues` is non-empty for machines that declare
 * data attributes. When the table is empty, one row is synthesised with `""`
 * (the AST's encoding of an undefined/absent value) for every attribute.
 * When the table is non-empty, every attribute from `data` is back-filled with
 * `""` into any row that is missing that column.
 *
 * @param stateMachine State machine to mutate.
 */
function synthesiseUndefinedRows(stateMachine: StateMachine): boolean {
    const allAttributes = sortedDataAttributes(stateMachine)
    if (allAttributes.length === 0) return false

    if (!stateMachine.dataExampleValues || stateMachine.dataExampleValues.length === 0) {
        const row: Record<string, string> = {}
        for (const attr of allAttributes) {
            row[attr] = ""
        }
        stateMachine.dataExampleValues = [row]
        return true
    }

    // Back-fill missing columns in existing rows.
    for (const row of stateMachine.dataExampleValues) {
        for (const attr of allAttributes) {
            if (!(attr in row)) {
                row[attr] = ""
            }
        }
    }

    return false
}

// --- Augment example table ---

/**
 * Returns the Cartesian product of the value sets in `byAttribute`.
 * Each entry in the returned array is a `Map` mapping attribute name to value
 * for one combination.
 *
 * @param byAttribute Map from (lower-cased) attribute name to the set of
 *   values required for that attribute in a particular context.
 * @returns All required row combinations for the context.
 */
function cartesianProduct(byAttribute: Map<string, string[]>): Map<string, string>[] {
    const entries = [...byAttribute.entries()]
    if (entries.length === 0) return []

    let result: Map<string, string>[] = [new Map()]

    for (const [attr, values] of entries) {
        const uniqueValues = [...new Set(values)]
        const expanded: Map<string, string>[] = []
        for (const existing of result) {
            for (const value of uniqueValues) {
                const copy = new Map(existing)
                copy.set(attr, value)
                expanded.push(copy)
            }
        }
        result = expanded
    }

    return result
}

/**
 * Returns `true` when `row` satisfies every (attribute, value) constraint in
 * `combination` (exact string equality after key lower-casing).
 *
 * @param row Example-values table row to test.
 * @param combination Required attribute-to-value mapping.
 * @returns `true` when every attribute in `combination` is present in `row`
 *   with the exact required value; `false` otherwise.
 */
function rowSatisfiesCombination(
    row: Record<string, string>,
    combination: Map<string, string>,
): boolean {
    for (const [attr, value] of combination) {
        if (row[attr] !== value) return false
    }
    return true
}

/**
 * Accumulates condition values from a flat argument list into `byAttribute`.
 *
 * @param args Arguments whose conditions should be scanned.
 * @param byAttribute Accumulator map (mutated in place).
 */
function accumulateArgumentConditions(
    args: Argument[],
    byAttribute: Map<string, string[]>,
): void {
    for (const arg of args) {
        if (!arg.condition) continue
        const values = extractConditionValues(arg.condition as Condition)
        if (values.length === 0) continue
        const key = arg.name.toLowerCase()
        const existing = byAttribute.get(key) ?? []
        byAttribute.set(key, [...existing, ...values])
    }
}

/**
 * Collects all condition-value combinations required by a state machine,
 * one `Map` per "context" (state implied conditions, default precondition,
 * or transition). Each map represents a conjunction of attribute-to-value
 * constraints that must be satisfiable by a single table row.
 *
 * @param stateMachine State machine to scan.
 * @returns Array of required row combinations (each may span multiple attributes).
 */
function collectRequiredCombinations(stateMachine: StateMachine): Map<string, string>[] {
    const combinations: Map<string, string>[] = []

    // State implied conditions — each state is its own context.
    for (const state of stateMachine.states) {
        const byAttribute = new Map<string, string[]>()
        for (const implied of state.impliedConditions ?? []) {
            const values = extractConditionValues(implied.condition)
            if (values.length === 0) continue
            const key = implied.attribute.toLowerCase()
            byAttribute.set(key, [...(byAttribute.get(key) ?? []), ...values])
        }
        combinations.push(...cartesianProduct(byAttribute))
    }

    // Default preconditions — each entry is its own context.
    for (const precondition of stateMachine.defaultPreconditions ?? []) {
        const byAttribute = new Map<string, string[]>()
        accumulateArgumentConditions(precondition.arguments ?? [], byAttribute)
        combinations.push(...cartesianProduct(byAttribute))
    }

    // Transitions — each transition is one combined context.
    // State trigger arguments are excluded for the same reason as in
    // `collectUsedAttributeNames`: they belong to the triggering machine, not this one.
    for (const transition of stateMachine.transitions ?? []) {
        const byAttribute = new Map<string, string[]>()
        for (const stateRef of transition.states ?? []) {
            accumulateArgumentConditions(stateRef.arguments ?? [], byAttribute)
        }
        if (transition.trigger.type === "event") {
            accumulateArgumentConditions(transition.trigger.arguments ?? [], byAttribute)
        }
        accumulateArgumentConditions(transition.result.arguments ?? [], byAttribute)
        combinations.push(...cartesianProduct(byAttribute))
    }

    return combinations
}

/**
 * [REQ-421] Augments `dataExampleValues` so that every condition-referenced
 * value combination is covered by at least one row. For each missing
 * combination, a new row is synthesised: conditioned attributes receive their
 * required values; every other attribute receives the first value found in the
 * existing table for that attribute, or `""` when none exists.
 *
 * The resulting table is sorted deterministically so that the completed AST
 * is stable across runs.
 *
 * @param stateMachine State machine to mutate.
 */
function augmentExampleTable(stateMachine: StateMachine, synthesizedUndefinedRow: boolean): void {
    const required = collectRequiredCombinations(stateMachine)
    if (required.length === 0) return

    const rows = stateMachine.dataExampleValues ?? []
    const allAttributes = sortedDataAttributes(stateMachine)

    for (const combination of required) {
        const alreadySatisfied = rows.some((row) => rowSatisfiesCombination(row, combination))
        if (alreadySatisfied) continue

        // Conditioned attributes use their required value; all others fall back
        // to the first existing row's value for that column, or "".
        const newRow: Record<string, string> = {}
        const firstRow = rows[0]
        for (const attr of allAttributes) {
            if (combination.has(attr)) {
                newRow[attr] = combination.get(attr)!
            } else {
                newRow[attr] = firstRow ? (firstRow[attr] ?? "") : ""
            }
        }
        rows.push(newRow)
    }

    // If step B synthesized a placeholder all-undefined row, and step C inferred
    // concrete condition-driven rows, remove that placeholder to avoid keeping an
    // extra undefined value for constrained attributes.
    if (synthesizedUndefinedRow && rows.length > 1) {
        const isPlaceholder = (row: Record<string, string>): boolean =>
            allAttributes.every((attr) => (row[attr] ?? "") === "")
        if (isPlaceholder(rows[0])) {
            rows.splice(0, 1)
        }
    }

    stateMachine.dataExampleValues = rows
}

// --- Public API ---

/**
 * Completes partially-defined state-machine ASTs in place so that the rigid
 * validation pass can succeed without requiring every attribute and every
 * example-value row to be declared explicitly in the source Markdown.
 *
 * Mutates each machine by performing, in order:
 *  - Infer data attributes from usage (example columns, implied conditions,
 *    default-precondition / transition arguments).
 *  - Synthesise a single all-`""` row when `dataExampleValues` is empty.
 *  - Augment `dataExampleValues` so that every condition-referenced value
 *    combination is satisfied by at least one row.
 *
 * @param stateMachines Array of parsed state machines to complete (mutated in place).
 */
export function completeStateMachines(stateMachines: StateMachine[]): void {
    for (const stateMachine of stateMachines) {
        inferDataAttributes(stateMachine)
        const synthesizedUndefinedRow = synthesiseUndefinedRows(stateMachine)
        augmentExampleTable(stateMachine, synthesizedUndefinedRow)
    }
}
