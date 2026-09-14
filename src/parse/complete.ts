/**
 * AST completion step.
 *
 * Reads a parsed (and trigger-classified) AST that may be partially defined
 * and mutates it in place so that the rigid `validateStateMachines` pass can
 * succeed without requiring the author to declare every attribute explicitly.
 *
 * Operations performed for each state machine, in order:
 *  - Derive `dataValueCombinations` from `dataValues` — the full cartesian product of the
 *    per-attribute value lists a machine declares in place of a combinations table
 *    (REQ-435).
 *  - Infer a result assignment for every transition landing in a state whose implied
 *    condition pins an attribute to a concrete value — a literal via `=`, or absence via
 *    `undefined` — when the transition's own result does not already assign or reference
 *    that attribute (REQ-434).
 *  - Infer data attributes from every usage site (example-value table columns,
 *    implied conditions, default-precondition / transition arguments).
 *  - Synthesise a single all-undefined row when `dataValueCombinations` is empty.
 *  - Augment `dataValueCombinations` so that every condition-referenced value
 *    combination is satisfied by at least one row, including the rows implied by
 *    attribute-reference conditions (REQ-426).
 */

import type { Argument, Condition, Result, StateMachine } from "./sm.ast.d"

// --- Shared helpers ---

/**
 * Extracts all literal values referenced by a condition expression.
 * Mirrors the same helper in `validate.ts` so that both steps treat
 * conditions identically.
 *
 * @param condition Condition expression to extract values from.
 * @returns Array of literal string values referenced by the condition.
 *   Returns `[]` for `"undefined"` and `"defined"` operators (neither pins a specific literal
 *   value) nor absent values. Also returns `[]` when the condition's value is a reference to
 *   another attribute (`valueIsReference`): a reference doesn't pin a literal value either — its
 *   value follows from the referenced attribute in the same row, not from this attribute's own
 *   example values — so it must not be treated as a required literal combination (REQ-421).
 *   For `"in"` operators, returns all listed values.
 *   For `"in range"` / `"not in range"` operators, returns the two boundary values.
 *   For all other operators, returns a single-element array with the value as a string.
 */
function extractConditionValues(condition: Condition): string[] {
    if (
        condition.operator === "undefined" || condition.operator === "defined"
        || condition.value === undefined || condition.valueIsReference
    ) {
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
 * Extracts the literal value referenced by a result expression. A result is always a plain
 * equality assignment (`attribute set to value`), never a range or set, so unlike
 * `extractConditionValues` there is at most one value to extract.
 *
 * @param result Result expression to extract the value from.
 * @returns A single-element array with the result's literal value, or `[]` when the result sets
 *   the attribute to undefined (REQ-421), or when its value is a reference to another attribute
 *   (`valueIsReference`) — a reference doesn't pin a literal value either, since it follows from
 *   the referenced attribute in the same row, not from this attribute's own example values.
 */
function extractResultValues(result: Result): string[] {
    if (result.value === undefined || result.valueIsReference) return []
    return [result.value]
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

// --- Reference conditions ---

/**
 * Condition operators for which an attribute-reference value pins the constrained attribute to
 * the referenced attribute's own row value, and can therefore imply an example row (REQ-426).
 *
 * Only the equality *filter* is listed. `=` (and its `is` spelling) tests that two attributes
 * coincide, so a row in which they do must exist for it to ever hold — that row is what REQ-426
 * supplies. `as` is not a filter but a sameness binding (REQ-432): the generator gives the
 * attribute the referenced value outright, so no row has to be manufactured for it to be found in.
 *
 * The remaining comparison operators (`<>`, `<`, `>`, `<=`, `>=`) accept a reference too, but
 * state what a row must *not* be, or an open-ended relation, so no single implied value follows.
 */
const REFERENCE_EQUALITY_OPERATORS = new Set<Condition["operator"]>(["="])

/**
 * A linked value requirement between two attributes: `attribute` holds whatever value
 * `referencedAttribute` holds in the same example row (REQ-426). Unlike a literal condition
 * value, a reference pins no value of its own — the value follows from the referenced attribute.
 */
interface ReferenceConstraint {
    attribute: string
    referencedAttribute: string
}

/**
 * Reads the linked value requirement expressed by an equality condition on an attribute
 * reference, e.g. `` `offer` as `list price` ``.
 *
 * @param attributeName Attribute the condition constrains.
 * @param condition Condition to read, if any.
 * @returns The constraint, or `undefined` when the condition holds a literal value, is absent,
 *   or uses an operator other than an equality one (REQ-426).
 */
function referenceConstraint(
    attributeName: string,
    condition: Condition | undefined,
): ReferenceConstraint | undefined {
    if (!condition?.valueIsReference || typeof condition.value !== "string") return undefined
    if (!REFERENCE_EQUALITY_OPERATORS.has(condition.operator)) return undefined
    return { attribute: attributeName.toLowerCase(), referencedAttribute: condition.value.toLowerCase() }
}

/**
 * Returns the distinct defined values an attribute already has in the example values table.
 * Undefined (`""`) cells are skipped: they pin no value a reference could copy.
 *
 * @param stateMachine State machine whose example values are read.
 * @param attributeName Attribute to collect the values of.
 * @returns The attribute's distinct defined values, in table order.
 */
function definedExampleValues(stateMachine: StateMachine, attributeName: string): string[] {
    const values = (stateMachine.dataValueCombinations ?? [])
        .map((row) => row[attributeName])
        .filter((value): value is string => value !== undefined && value !== "")
    return [...new Set(values)]
}

// --- Derive value combinations ---

/**
 * [REQ-435] Upper bound on the rows a `### Values` list may derive. The product of a handful of
 * per-attribute value lists grows fast enough that a plausible-looking list can ask for a scenario
 * count no test run would finish, so the expansion is capped rather than attempted.
 */
export const MAX_DERIVED_VALUE_COMBINATIONS = 1000

/**
 * [REQ-435] Replaces `dataValueCombinations` with the full cartesian product of `dataValues` — the
 * per-attribute value lists a source declares in place of a combinations table.
 *
 * The product is laid out with the last-declared attribute varying fastest, so the rows read in
 * the order the `### Values` list suggests. `dataValues` is left in place: it is what the source
 * declared, and the complete step only ever adds to the AST.
 *
 * @param stateMachine State machine to mutate. One without `dataValues` is left untouched.
 * @throws Error When the product would exceed `MAX_DERIVED_VALUE_COMBINATIONS` rows, or when an
 *   attribute's value list is empty (nothing to combine, which would collapse the product to
 *   nothing at all).
 */
function deriveValueCombinations(stateMachine: StateMachine): void {
    const dataValues = stateMachine.dataValues
    if (!dataValues) return

    const entries = Object.entries(dataValues)
    const empty = entries.filter(([, values]) => values.length === 0).map(([attribute]) => attribute)
    if (empty.length > 0) {
        throw new Error(
            `State machine \`${stateMachine.name}\`: \`### Values\` declares no value for ` +
            `${empty.map((attribute) => `\`${attribute}\``).join(", ")} (REQ-435).`,
        )
    }

    const total = entries.reduce((count, [, values]) => count * new Set(values).size, 1)
    if (total > MAX_DERIVED_VALUE_COMBINATIONS) {
        throw new Error(
            `State machine \`${stateMachine.name}\`: \`### Values\` would derive ` +
            `${total} combinations, above the maximum of ${MAX_DERIVED_VALUE_COMBINATIONS}. ` +
            `Reduce the number of values, or spell the combinations out in a ` +
            `\`### Value combinations\` table (REQ-435).`,
        )
    }

    const product = cartesianProduct(new Map(entries))
    stateMachine.dataValueCombinations = product.map((combination) => Object.fromEntries(combination))
}

// --- Infer implied result assignments ---

/**
 * Builds an index from (lower-cased) state name to that state's own implied conditions, across
 * every machine in the AST. Mirrors the equivalent index in `validate.ts` (REQ-433) so both steps
 * resolve a transition's target state identically. A name declared by more than one machine is a
 * REQ-402 violation reported elsewhere; the first declaration found wins here, same as there.
 *
 * @param stateMachines Every state machine in the AST.
 * @returns Implied conditions declared per lower-cased state name.
 */
function buildImpliedIndex(stateMachines: StateMachine[]): Record<string, { attribute: string, condition: Condition }[]> {
    const impliedIndex: Record<string, { attribute: string, condition: Condition }[]> = {}
    for (const stateMachine of stateMachines) {
        for (const state of stateMachine.states) {
            if (!state.impliedConditions?.length) continue
            const key = state.name.toLowerCase()
            if (!(key in impliedIndex)) impliedIndex[key] = state.impliedConditions
        }
    }
    return impliedIndex
}

/**
 * The result payload a literal implied condition pins, when it pins one.
 *
 * @param condition Implied condition to read.
 * @returns `{ value: <literal> }` for a plain literal `=`, `{}` (no `value`, matching how the
 *   grammar represents `set to undefined`) for `undefined`, or `undefined` when the condition
 *   pins no concrete value at all — a `defined` declaration (any value satisfies it, so none can
 *   be chosen), a reference-valued `=` (the value lives in another attribute, not a literal), or
 *   any other operator.
 */
function impliedResultValue(condition: Condition): Result | undefined {
    if (condition.operator === "undefined") return {}
    if (condition.operator === "=" && !condition.valueIsReference && typeof condition.value === "string") {
        return { value: condition.value }
    }
    return undefined
}

/**
 * [REQ-434] For every transition, adds a synthesized result argument for each attribute the
 * target state's implied conditions pin to a concrete value — a plain literal via `=`, or absence
 * via `undefined` — unless the transition's own result already assigns or references that
 * attribute.
 *
 * A state's implied conditions describe every occurrence of that state (REQ-433), so both of
 * these hold on arrival regardless of what the transition otherwise carries forward — an author
 * who leaves the attribute unset in the result is stating the obvious, not omitting information.
 * `defined` is the one case left out: unlike `undefined`, it does not pin a single concrete value
 * (any defined value satisfies it), so there is nothing to synthesize; REQ-433 continues to
 * validate a transition against it from whatever the transition otherwise determines.
 *
 * A transition's own explicit result for the attribute — a literal, a reference, or an explicit
 * `set to undefined` — is never touched, even one that contradicts the target: that reflects a
 * decision the author actually wrote down, so it remains a REQ-433 error rather than being
 * silently overwritten.
 *
 * @param stateMachine State machine to mutate.
 * @param impliedIndex Implied conditions declared per lower-cased state name, across the AST.
 */
function inferImpliedResultAssignments(
    stateMachine: StateMachine,
    impliedIndex: Record<string, { attribute: string, condition: Condition }[]>,
): void {
    for (const transition of stateMachine.transitions ?? []) {
        const target = transition.result
        for (const implied of impliedIndex[target.name.toLowerCase()] ?? []) {
            const result = impliedResultValue(implied.condition)
            if (!result) continue

            const attribute = implied.attribute.toLowerCase()
            const alreadyAssigned = (target.arguments ?? []).some((arg) => arg.name.toLowerCase() === attribute)
            if (alreadyAssigned) continue

            target.arguments ??= []
            target.arguments.push({ name: implied.attribute, result })
        }
    }
}

// --- Infer data attributes ---

/**
 * Collects every attribute name referenced anywhere in the state machine:
 * - Column names in the existing `dataValueCombinations` table.
 * - `implied.attribute` from state implied conditions.
 * - `argument.name` from default-precondition arguments, transition state
 *   arguments, trigger arguments, and result arguments.
 *
 * An argument whose condition value is an attribute reference (e.g. `` `offer` as `list price` ``)
 * declares its own attribute here like any other argument: the constrained attribute belongs to
 * this machine's attribute space, only its *value* comes from the referenced attribute (REQ-419).
 * This is the opposite of a result argument set to a reference, excluded below.
 *
 * @param stateMachine State machine to scan.
 * @returns Sorted, de-duplicated set of lower-cased attribute names.
 */
export function collectUsedAttributeNames(stateMachine: StateMachine): string[] {
    const names = new Set<string>()

    // Example-value table column names.
    for (const row of stateMachine.dataValueCombinations ?? []) {
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
        // A result argument whose result is a reference to another attribute is excluded for
        // the same reason state-trigger arguments are: its value never comes from this attribute's
        // own example values (it follows from the referenced attribute instead), so this
        // occurrence alone must not force a declaration for it.
        for (const argument of transition.result.arguments ?? []) {
            if (argument.result?.valueIsReference) continue
            names.add(argument.name.toLowerCase())
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
 * [REQ-420] Ensures `dataValueCombinations` is non-empty for machines that declare
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

    if (!stateMachine.dataValueCombinations || stateMachine.dataValueCombinations.length === 0) {
        const row: Record<string, string> = {}
        for (const attr of allAttributes) {
            row[attr] = ""
        }
        stateMachine.dataValueCombinations = [row]
        return true
    }

    // Back-fill missing columns in existing rows.
    for (const row of stateMachine.dataValueCombinations) {
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
 * The value requirements collected for one context (a state's implied conditions, a default
 * precondition, or a transition): the literal values required per attribute, plus the linked
 * requirements expressed by attribute references (REQ-426), which pin no literal of their own.
 */
interface ContextRequirements {
    byAttribute: Map<string, string[]>
    constraints: ReferenceConstraint[]
}

/**
 * Returns an empty requirements accumulator for one context.
 *
 * @returns A requirements accumulator with no values and no constraints yet.
 */
function emptyRequirements(): ContextRequirements {
    return { byAttribute: new Map(), constraints: [] }
}

/**
 * Accumulates literal values required for one attribute into `requirements`.
 *
 * @param attributeName Attribute the values belong to.
 * @param values Literal values required for the attribute; an empty list is ignored.
 * @param requirements Accumulator for the surrounding context (mutated in place).
 */
function accumulateValues(
    attributeName: string,
    values: string[],
    requirements: ContextRequirements,
): void {
    if (values.length === 0) return
    const key = attributeName.toLowerCase()
    const existing = requirements.byAttribute.get(key) ?? []
    requirements.byAttribute.set(key, [...existing, ...values])
}

/**
 * Accumulates one attribute's condition into `requirements`: its literal values, or — when the
 * condition value is an attribute reference — the linked requirement it expresses instead.
 *
 * @param attributeName Attribute the condition constrains.
 * @param condition Condition to scan.
 * @param requirements Accumulator for the surrounding context (mutated in place).
 */
function accumulateCondition(
    attributeName: string,
    condition: Condition,
    requirements: ContextRequirements,
): void {
    const constraint = referenceConstraint(attributeName, condition)
    if (constraint) {
        requirements.constraints.push(constraint)
        return
    }
    accumulateValues(attributeName, extractConditionValues(condition), requirements)
}

/**
 * Accumulates condition/result requirements from a flat argument list. Each argument carries
 * either `condition` (a state or trigger argument) or `result` (a transition result argument),
 * never both — whichever is present is the value/reference expression to scan.
 *
 * @param args Arguments whose condition/result should be scanned.
 * @param requirements Accumulator for the surrounding context (mutated in place).
 */
function accumulateArgumentConditions(
    args: Argument[],
    requirements: ContextRequirements,
): void {
    for (const arg of args) {
        if (arg.condition) {
            accumulateCondition(arg.name, arg.condition, requirements)
            continue
        }
        if (arg.result) {
            accumulateValues(arg.name, extractResultValues(arg.result), requirements)
        }
    }
}

/**
 * [REQ-426] Expands the literal combinations of one context with its linked reference
 * requirements: a constrained attribute takes the value the referenced attribute holds in the
 * same row, so the implied combination holds both.
 *
 * When the referenced attribute is already pinned within the same combination, the constrained
 * attribute simply copies that value. Otherwise the combination fans out over the referenced
 * attribute's own defined example values — the constrained attribute is thereby implicitly
 * defined from the attribute it references. A referenced attribute with no defined value of its
 * own (e.g. one declared by another state machine) implies no combination: there is no value to
 * copy, since this machine's table holds none.
 *
 * @param stateMachine State machine whose existing example values supply the value pool.
 * @param requirements Requirements collected for one context.
 * @returns The context's required row combinations, reference requirements included.
 */
function expandReferenceConstraints(
    stateMachine: StateMachine,
    requirements: ContextRequirements,
): Map<string, string>[] {
    const literalCombinations = cartesianProduct(requirements.byAttribute)
    if (requirements.constraints.length === 0) return literalCombinations

    let combinations = literalCombinations.length === 0 ? [new Map<string, string>()] : literalCombinations
    for (const { attribute, referencedAttribute } of requirements.constraints) {
        const expanded: Map<string, string>[] = []
        for (const combination of combinations) {
            const pinnedValue = combination.get(referencedAttribute)
            if (pinnedValue !== undefined) {
                expanded.push(new Map(combination).set(attribute, pinnedValue))
                continue
            }
            const values = definedExampleValues(stateMachine, referencedAttribute)
            if (values.length === 0) {
                expanded.push(combination)
                continue
            }
            for (const value of values) {
                expanded.push(new Map(combination).set(attribute, value).set(referencedAttribute, value))
            }
        }
        combinations = expanded
    }
    return combinations.filter((combination) => combination.size > 0)
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
        const requirements = emptyRequirements()
        for (const implied of state.impliedConditions ?? []) {
            accumulateCondition(implied.attribute, implied.condition, requirements)
        }
        combinations.push(...expandReferenceConstraints(stateMachine, requirements))
    }

    // Default preconditions — each entry is its own context.
    for (const precondition of stateMachine.defaultPreconditions ?? []) {
        const requirements = emptyRequirements()
        accumulateArgumentConditions(precondition.arguments ?? [], requirements)
        combinations.push(...expandReferenceConstraints(stateMachine, requirements))
    }

    // Transitions — each transition is one combined context.
    // State trigger arguments are excluded for the same reason as in
    // `collectUsedAttributeNames`: they belong to the triggering machine, not this one.
    for (const transition of stateMachine.transitions ?? []) {
        const requirements = emptyRequirements()
        for (const stateRef of transition.states ?? []) {
            accumulateArgumentConditions(stateRef.arguments ?? [], requirements)
        }
        if (transition.trigger.type === "event") {
            accumulateArgumentConditions(transition.trigger.arguments ?? [], requirements)
        }
        accumulateArgumentConditions(transition.result.arguments ?? [], requirements)
        combinations.push(...expandReferenceConstraints(stateMachine, requirements))
    }

    return combinations
}

/**
 * [REQ-421] Augments `dataValueCombinations` so that every condition-referenced
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

    const rows = stateMachine.dataValueCombinations ?? []
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

    stateMachine.dataValueCombinations = rows
}

// --- Public API ---

/**
 * Completes partially-defined state-machine ASTs in place so that the rigid
 * validation pass can succeed without requiring every attribute and every
 * example-value row to be declared explicitly in the source Markdown.
 *
 * Mutates each machine by performing, in order:
 *  - Derive `dataValueCombinations` from `dataValues` as their full cartesian product (REQ-435).
 *  - Infer a result assignment for every transition landing in a state whose implied
 *    condition pins an attribute to a concrete value — a literal via `=`, or absence via
 *    `undefined` — when the transition's own result does not already assign or reference
 *    that attribute (REQ-434).
 *  - Infer data attributes from usage (example columns, implied conditions,
 *    default-precondition / transition arguments).
 *  - Synthesise a single all-`""` row when `dataValueCombinations` is empty.
 *  - Augment `dataValueCombinations` so that every condition-referenced value
 *    combination is satisfied by at least one row, including the rows implied by
 *    attribute-reference conditions (REQ-426).
 *
 * @param stateMachines Array of parsed state machines to complete (mutated in place).
 */
export function completeStateMachines(stateMachines: StateMachine[]): void {
    const impliedIndex = buildImpliedIndex(stateMachines)
    for (const stateMachine of stateMachines) {
        deriveValueCombinations(stateMachine)
        inferImpliedResultAssignments(stateMachine, impliedIndex)
        inferDataAttributes(stateMachine)
        const synthesizedUndefinedRow = synthesiseUndefinedRows(stateMachine)
        augmentExampleTable(stateMachine, synthesizedUndefinedRow)
    }
}
