import * as fs from "fs"
import * as path from "path"
import { fileURLToPath } from "url"
import Ajv, { type ErrorObject, type ValidateFunction } from "ajv"
import type { Argument, Condition, DefaultPrecondition, Result, StateMachine, Transition } from "./sm.ast.d"
import { buildTaggedTransitions, collectChainStateMachineNames, findUnresolvableTrigger } from "./expand"
import { effectiveExampleValues } from "./examples"
import { buildStateOwnership } from "./ownership"

/**
 * JSON Schema validation for the parsed state-machine AST, checked against
 * `sm.ast.schema.json` (the source of truth that `sm.ast.d.ts` is generated
 * from). Used by the `generate` and test-harness code paths to fail fast
 * with a clear, itemized error message when the AST passed in does not
 * conform to the schema (e.g. a stray/misplaced property that the parser
 * would never produce, such as a `condition` directly on a `trigger`
 * instead of on one of its `arguments`).
 */

const schemaDir = path.dirname(fileURLToPath(import.meta.url))
const schemaPath = path.join(schemaDir, "sm.ast.schema.json")

let cachedValidator: ValidateFunction | undefined

type SchemaContext = {
    filePath: string
    machineName: string
    machineIndex: number
    transitionIndex?: number
    transitionLabel?: string
    fieldName?: string
    value: unknown
}

/**
 * Lazily compiles and caches the schema validator instance.
 *
 * @returns The cached or newly-compiled `Ajv` validator for `StateMachine[]` data.
 */
function getValidator(): ValidateFunction {
    if (cachedValidator) return cachedValidator
    const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"))
    const ajv = new Ajv({ allErrors: true, strict: false })
    cachedValidator = ajv.compile(schema)
    return cachedValidator
}

/**
 * Resolves a JSON Pointer path into the parsed AST.
 *
 * @param data Parsed AST payload being validated.
 * @param instancePath JSON Pointer path from an `Ajv` error.
 * @returns The resolved value at `instancePath`, or `undefined` if the path is not resolvable.
 */
function resolveInstancePath(data: unknown, instancePath: string): unknown {
    const segments = instancePath.split("/").slice(1).map((segment) => segment.replace(/~1/g, "/").replace(/~0/g, "~"))
    let current: unknown = data

    for (const segment of segments) {
        if (current === undefined || current === null) return undefined
        if (Array.isArray(current)) {
            const index = Number(segment)
            if (!Number.isInteger(index) || index < 0 || index >= current.length) return undefined
            current = current[index]
            continue
        }
        if (typeof current !== "object") return undefined
        current = (current as Record<string, unknown>)[segment]
    }

    return current
}

/**
 * Returns a compact string for an arbitrary JSON value.
 *
 * @param value Value to stringify for diagnostics.
 * @returns A compact, backticked representation suitable for error messages.
 */
function formatValue(value: unknown): string {
    if (value === undefined) return "undefined"
    if (typeof value === "string") return `\`${value}\``
    if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") return `\`${String(value)}\``
    if (value === null) return "`null`"
    try {
        return `\`${JSON.stringify(value)}\``
    } catch {
        return `\`${String(value)}\``
    }
}

/**
 * Builds machine, transition, and field context for a schema error.
 *
 * @param data Parsed AST payload that produced the schema error.
 * @param error Single `Ajv` schema validation error.
 * @returns Context object used to format a readable validation issue.
 */
function buildSchemaContext(data: unknown, error: ErrorObject): SchemaContext {
    const machineIndex = Number(error.instancePath.split("/")[1] ?? "0")
    const machines = Array.isArray(data) ? data : []
    const machine = machines[machineIndex] as StateMachine | undefined
    const transitionIndex = Number(error.instancePath.split("/")[3] ?? "")
    const transition = machine?.transitions?.[transitionIndex]
    const value = resolveInstancePath(data, error.instancePath)
    const machineName = machine?.name ?? `<machine ${machineIndex}>`
    const filePath = machine?.source ?? "<unknown source>"

    return {
        filePath,
        machineName,
        machineIndex,
        transitionIndex: Number.isInteger(transitionIndex) ? transitionIndex : undefined,
        transitionLabel: transition ? (transition.id ? `transition ${transition.id}` : `transition at line ${transition.sourceLine ?? "unknown"}`) : undefined,
        fieldName: error.instancePath.split("/").filter(Boolean).at(-1),
        value,
    }
}

/**
 * Formats a single `Ajv` error with source and AST context.
 *
 * @param data Parsed AST payload that produced the schema error.
 * @param error Single `Ajv` schema validation error.
 * @returns Multi-line human-readable error text with location and value context.
 */
function formatSchemaError(data: unknown, error: ErrorObject): string {
    const context = buildSchemaContext(data, error)
    const allowedValues = error.keyword === "enum" ? (error.params as { allowedValues?: unknown[] }).allowedValues : undefined
    const allowedValuesText = allowedValues?.length ? `\n    Allowed values: ${allowedValues.map(formatValue).join(", ")}` : ""
    const actualValueText = context.value === undefined && error.keyword === "required"
        ? ""
        : `\n    Actual value: ${formatValue(context.value)}`

    return [
        `- File: ${formatValue(context.filePath)}`,
        `  Machine: ${formatValue(context.machineName)}`,
        context.transitionLabel ? `  ${context.transitionLabel[0].toUpperCase()}${context.transitionLabel.slice(1)}` : undefined,
        `  Path: ${formatValue(error.instancePath || "/")}`,
        context.fieldName ? `  Field: ${formatValue(context.fieldName)}` : undefined,
        `  Error: ${error.message ?? "is invalid"}` + allowedValuesText + actualValueText,
    ].filter((line): line is string => Boolean(line)).join("\n")
}

/**
 * Validates `data` (the parsed state-machine AST, i.e. an array of
 * `StateMachine` objects) against `sm.ast.schema.json`.
 *
 * @param data Candidate parsed state-machine AST.
 * @returns Nothing. Validation succeeds by not throwing.
 * @throws Error listing every schema violation (JSON path + message) when
 * `data` does not conform to the schema.
 */
export function validateStateMachines(data: unknown): void {
    const validate = getValidator()
    const valid = validate(data)
    if (!valid) {
        const issues = (validate.errors ?? [])
            .map((err) => formatSchemaError(data, err))
            .join("\n")
        throw new Error(`Invalid state machine AST — schema validation failed:\n${issues}`)
    }

    const stateMachines = data as StateMachine[]

    validateStateNameUniqueness(stateMachines)
    validateDataValueTableColumns(stateMachines)
    validateStructuralRefs(stateMachines)
    validateModifierBaseReferences(stateMachines)
    validateModifierValuePoolSize(stateMachines)
    validateReferenceOperators(stateMachines)
    validateReferenceTargets(stateMachines)

    // [REQ-406/REQ-411] Business-rule checks performed after schema validation
    // succeeds, since they rely on `data` actually conforming to the
    // `StateMachine[]` shape. Trigger resolution runs first: a transition whose
    // trigger has no cause would otherwise be reported for the example values it
    // could not reach.
    validateStateTriggerResolution(stateMachines)
    validateExampleValuesPresence(stateMachines)
}

/**
 * [REQ-417] Ensures data-value tables contain columns for all declared data attributes.
 *
 * @param stateMachines Parsed state-machine AST nodes.
 * @returns Nothing. Validation succeeds by not throwing.
 * @throws Error When a data-value table omits a declared attribute column.
 */
export function validateDataValueTableColumns(stateMachines: StateMachine[]): void {
    for (const stateMachine of stateMachines) {
        const declaredAttributes = new Set(
            Object.keys(stateMachine.data ?? {}).map((attributeName) => attributeName.toLowerCase()),
        )
        if (declaredAttributes.size === 0) continue

        validateDataRowsContainDeclaredAttributes(
            stateMachine,
            "Example values",
            stateMachine.dataExampleValues ?? [],
            declaredAttributes,
        )
    }
}

/**
 * Validates that each row in a data table contains every declared attribute column.
 *
 * @param stateMachine Owning state machine for the table being validated.
 * @param tableLabel Human-readable table label used in the error message.
 * @param rows Table rows to validate.
 * @param declaredAttributes Declared data attributes that must exist as columns.
 * @returns Nothing. Validation succeeds by not throwing.
 * @throws Error When one or more declared attributes are missing from the table columns.
 */
function validateDataRowsContainDeclaredAttributes(
    stateMachine: StateMachine,
    tableLabel: string,
    rows: Record<string, string>[],
    declaredAttributes: Set<string>,
): void {
    if (rows.length === 0) return

    const presentColumns = new Set(
        Object.keys(rows[0] ?? {}).map((attributeName) => attributeName.toLowerCase()),
    )
    const missingColumns = [...declaredAttributes].filter((attributeName) => !presentColumns.has(attributeName))
    if (missingColumns.length === 0) return

    throw new Error(
        `State machine \`${stateMachine.name}\`: ${tableLabel} table is missing column(s) for declared attribute(s): ` +
        `${missingColumns.map((attributeName) => `\`${attributeName}\``).join(", ")} (REQ-417).`,
    )
}

/**
 * Returns `true` when the given argument array is non-empty.
 *
 * @param args Optional argument array.
 * @returns `true` when `args` exists and contains at least one item.
 */
function hasArguments(args: Argument[] | undefined): boolean {
    return Array.isArray(args) && args.length > 0
}

/**
 * Returns `true` when a transition (together with the owning machine's
 * default preconditions) references at least one argument — via a
 * precondition state, a default precondition, the trigger, or the result.
 *
 * @param transition Transition being analyzed.
 * @param defaultPreconditions Defaults from the owning state machine.
 * @returns `true` when at least one argument reference is present.
 */
function transitionReferencesArguments(
    transition: Transition,
    defaultPreconditions: DefaultPrecondition[],
): boolean {
    return (
        defaultPreconditions.some((precondition) => hasArguments(precondition.arguments))
        || (transition.states ?? []).some((ref) => hasArguments(ref.arguments))
        || hasArguments(transition.trigger.arguments)
        || hasArguments(transition.result.arguments)
    )
}

/**
 * Builds a readable transition label used in validation error messages.
 *
 * @param stateMachineName Name of the transition's owning state machine.
 * @param transition Transition to describe.
 * @returns Human-readable transition context string.
 */
function formatTransitionContext(stateMachineName: string, transition: Transition): string {
    return `Transition \`${transition.id ?? "<anonymous>"}\` in state machine \`${stateMachineName}\``
}

/**
 * Returns the state names declared by a state machine as a lower-cased set.
 *
 * @param stateMachine State machine whose states should be indexed.
 * @returns Set of lower-cased state names declared by `stateMachine`.
 */
function buildOwnStateSet(stateMachine: StateMachine): Set<string> {
    return new Set(stateMachine.states.map((state) => state.name.toLowerCase()))
}

/**
 * Resolves the default preconditions that effectively apply to a transition.
 *
 * A default precondition is skipped when the transition already contains a
 * precondition state from the same owning state machine.
 *
 * @param transition Transition that may override default preconditions.
 * @param defaultPreconditions Declared default preconditions on the owning machine.
 * @param ownership Map of lower-cased state names to owning machine names.
 * @returns Filtered list of default preconditions that still apply.
 */
function getEffectiveDefaultPreconditions(
    transition: Transition,
    defaultPreconditions: DefaultPrecondition[],
    ownership: Record<string, string>,
): DefaultPrecondition[] {
    const referencedOwners = new Set<string>()
    for (const stateRef of transition.states ?? []) {
        const owner = ownership[stateRef.name.toLowerCase()]
        if (owner) referencedOwners.add(owner)
    }

    return defaultPreconditions.filter((precondition) => {
        const owner = ownership[precondition.state.toLowerCase()]
        return owner ? !referencedOwners.has(owner) : true
    })
}

/**
 * Collects every argument in a transition's effective context.
 *
 * @param transition Transition being analyzed.
 * @param effectiveDefaultPreconditions Default preconditions that apply to this transition.
 * @returns Flattened list of arguments from defaults, explicit preconditions, trigger, and result.
 */
function collectTransitionArguments(
    transition: Transition,
    effectiveDefaultPreconditions: DefaultPrecondition[],
): Argument[] {
    const argumentsList: Argument[] = []
    for (const precondition of effectiveDefaultPreconditions) {
        argumentsList.push(...(precondition.arguments ?? []))
    }
    for (const stateRef of transition.states ?? []) {
        argumentsList.push(...(stateRef.arguments ?? []))
    }
    argumentsList.push(...(transition.trigger.arguments ?? []))
    argumentsList.push(...(transition.result.arguments ?? []))
    return argumentsList
}

/**
 * Normalizes a raw table value for modifier-pool validation.
 *
 * Empty-string cells are treated as `undefined` values so they remain part of
 * the pool instead of being dropped.
 */
function normalizeValuePoolEntry(value: string | undefined): string | undefined {
    return value === "" ? undefined : value
}

/**
 * [REQ-402] Ensures state names are globally unique across all machines.
 *
 * @param stateMachines Parsed state-machine AST nodes.
 * @returns Nothing. Validation succeeds by not throwing.
 * @throws Error When two machines declare the same state name (case-insensitive).
 */
export function validateStateNameUniqueness(stateMachines: StateMachine[]): void {
    const firstOwnerByStateName = new Map<string, string>()

    for (const stateMachine of stateMachines) {
        for (const state of stateMachine.states) {
            const key = state.name.toLowerCase()
            const existingOwner = firstOwnerByStateName.get(key)
            if (!existingOwner) {
                firstOwnerByStateName.set(key, stateMachine.name)
                continue
            }

            throw new Error(
                `State name \`${state.name}\` is declared in state machines ` +
                `\`${existingOwner}\` and \`${stateMachine.name}\`. State names must be globally unique.`,
            )
        }
    }
}

/**
 * [REQ-403/404/405/406/407/408] Validates state references and ownership
 * constraints that can be checked from the flat AST structure.
 *
 * @param stateMachines Parsed state-machine AST nodes.
 * @returns Nothing. Validation succeeds by not throwing.
 * @throws Error When a state reference violates structural ownership rules.
 */
export function validateStructuralRefs(stateMachines: StateMachine[]): void {
    const ownership = buildStateOwnership(stateMachines)

    for (const stateMachine of stateMachines) {
        const ownStateNames = buildOwnStateSet(stateMachine)
        const defaultPreconditions = stateMachine.defaultPreconditions ?? []

        for (const precondition of defaultPreconditions) {
            const owner = ownership[precondition.state.toLowerCase()]
            if (!owner) {
                throw new Error(
                    `State machine \`${stateMachine.name}\`: Default precondition state ` +
                    `\`${precondition.state}\` is not declared in any state machine.`,
                )
            }
        }

        for (const transition of stateMachine.transitions ?? []) {
            const transitionContext = formatTransitionContext(stateMachine.name, transition)
            const seenNames = new Map<string, string>()
            const seenOwners = new Map<string, string>()

            for (const stateRef of transition.states ?? []) {
                const stateKey = stateRef.name.toLowerCase()
                const seenName = seenNames.get(stateKey)
                if (seenName) {
                    throw new Error(
                        `${transitionContext}: State \`${stateRef.name}\` appears more than once in the precondition list.`,
                    )
                }
                seenNames.set(stateKey, stateRef.name)

                const owner = ownership[stateKey]
                if (!owner) {
                    throw new Error(
                        `${transitionContext}: Precondition state \`${stateRef.name}\` is not declared in any state machine.`,
                    )
                }

                const seenOwnerState = seenOwners.get(owner)
                if (seenOwnerState) {
                    throw new Error(
                        `${transitionContext}: Precondition list contains two states from machine ` +
                        `\`${owner}\`: \`${seenOwnerState}\` and \`${stateRef.name}\`.`,
                    )
                }
                seenOwners.set(owner, stateRef.name)
            }

            if (transition.trigger.type === "state") {
                const triggerOwner = ownership[transition.trigger.name.toLowerCase()]
                if (!triggerOwner) {
                    throw new Error(
                        `${transitionContext}: State trigger \`${transition.trigger.name}\` is not declared in any state machine.`,
                    )
                }
                if (triggerOwner === stateMachine.name) {
                    throw new Error(
                        `${transitionContext}: State trigger \`${transition.trigger.name}\` belongs to the same state machine ` +
                        `- state triggers must reference another state machine's state.`,
                    )
                }
            }

            if (!ownStateNames.has(transition.result.name.toLowerCase())) {
                throw new Error(
                    `${transitionContext}: Result state \`${transition.result.name}\` is not a declared state of this machine.`,
                )
            }
        }
    }
}

/**
 * [REQ-412] Ensures every modified argument has a same-transition base reference.
 *
 * @param stateMachines Parsed state-machine AST nodes.
 * @returns Nothing. Validation succeeds by not throwing.
 * @throws Error When a modified argument has no unmodified base in the same transition context.
 */
export function validateModifierBaseReferences(stateMachines: StateMachine[]): void {
    const ownership = buildStateOwnership(stateMachines)

    for (const stateMachine of stateMachines) {
        const defaultPreconditions = stateMachine.defaultPreconditions ?? []
        for (const transition of stateMachine.transitions ?? []) {
            const effectiveDefaults = getEffectiveDefaultPreconditions(transition, defaultPreconditions, ownership)
            const transitionArguments = collectTransitionArguments(transition, effectiveDefaults)
            const baseNames = new Set(
                transitionArguments
                    .filter((argument) => !argument.modifier)
                    .map((argument) => argument.name.toLowerCase()),
            )

            for (const argument of transitionArguments) {
                if (!argument.modifier) continue
                if (baseNames.has(argument.name.toLowerCase())) continue

                throw new Error(
                    `${formatTransitionContext(stateMachine.name, transition)}: Modifier \`${argument.modifier}\` on attribute ` +
                    `\`${argument.name}\` has no base reference in this transition.`,
                )
            }
        }
    }
}

/**
 * [REQ-413/414] Validates modifier-specific value-pool constraints:
 * minimum cardinality and numeric value requirements.
 *
 * @param stateMachines Parsed state-machine AST nodes.
 * @returns Nothing. Validation succeeds by not throwing.
 * @throws Error When modifier constraints are not satisfiable by the available value pools.
 */
export function validateModifierValuePoolSize(stateMachines: StateMachine[]): void {
    const ownership = buildStateOwnership(stateMachines)
    const taggedTransitions = buildTaggedTransitions(stateMachines)
    const machineByName = new Map(stateMachines.map((stateMachine) => [stateMachine.name, stateMachine]))
    const requiresTwoDistinctValues = new Set(["next", "previous"])
    const requiresNumericValues = new Set(["incremented", "decremented"])

    for (const stateMachine of stateMachines) {
        const defaultPreconditions = stateMachine.defaultPreconditions ?? []

        for (const transition of stateMachine.transitions ?? []) {
            const effectiveDefaults = getEffectiveDefaultPreconditions(transition, defaultPreconditions, ownership)
            const transitionArguments = collectTransitionArguments(transition, effectiveDefaults)
            const modifiedArguments = transitionArguments.filter((argument) => Boolean(argument.modifier))
            if (modifiedArguments.length === 0) continue

            const contributingNames = collectChainStateMachineNames(
                stateMachine,
                transition,
                effectiveDefaults,
                ownership,
                taggedTransitions,
            )

            const valuePoolByAttribute = new Map<string, Set<string | undefined>>()
            for (const contributingName of contributingNames) {
                const contributingMachine = machineByName.get(contributingName)
                if (!contributingMachine) continue

                const rows = contributingMachine.dataExampleValues ?? []
                for (const row of rows) {
                    for (const [attributeName, attributeValue] of Object.entries(row as Record<string, string | undefined>)) {
                        if (typeof attributeValue !== "string" && attributeValue !== undefined) continue
                        const key = attributeName.toLowerCase()
                        if (!valuePoolByAttribute.has(key)) valuePoolByAttribute.set(key, new Set<string | undefined>())
                        valuePoolByAttribute.get(key)?.add(normalizeValuePoolEntry(attributeValue))
                    }
                }
            }

            for (const argument of modifiedArguments) {
                const modifier = argument.modifier as string
                const attributeKey = argument.name.toLowerCase()
                const values = valuePoolByAttribute.get(attributeKey) ?? new Set<string | undefined>()

                if (requiresTwoDistinctValues.has(modifier) && values.size < 2) {
                    throw new Error(
                        `${formatTransitionContext(stateMachine.name, transition)}: Modifier \`${modifier}\` on attribute ` +
                        `\`${argument.name}\` requires at least 2 distinct values in the values pool, but only ` +
                        `\`${values.size}\` was found.`,
                    )
                }

                if (requiresNumericValues.has(modifier)) {
                    for (const value of values) {
                        if (typeof value === "string" && Number.isFinite(Number(value))) continue
                        throw new Error(
                            `State machine \`${stateMachine.name}\`: Modifier \`${modifier}\` on attribute ` +
                            `\`${argument.name}\` - value \`${value}\` in the values pool is not numeric.`,
                        )
                    }
                }
            }
        }
    }
}

/** Condition operators that compare against a single scalar value, and therefore accept an
 *  attribute reference as that value (REQ-424). The set (`in`, `not in`) and range (`in range`,
 *  `not in range`) operators take a fixed list of literals instead, and the unary `undefined` /
 *  `defined` operators take no value at all. */
const SCALAR_CONDITION_OPERATORS = new Set<Condition["operator"]>([
    "=", "<>", "<", ">", "<=", ">=", "as", "not as",
])

/**
 * Visits every value expression in the AST — each condition (state implied conditions,
 * default-precondition arguments, transition state arguments, transition trigger arguments) and
 * each transition result argument's result — so the reference-value checks below traverse the
 * AST once, in one place, rather than each repeating the same walk.
 *
 * @param stateMachines Parsed state-machine AST nodes.
 * @param visit Callback invoked per value expression, with a human-readable context, the
 *   constrained attribute's name, and the condition or result carrying the value.
 */
function forEachValueExpression(
    stateMachines: StateMachine[],
    visit: (context: string, attributeName: string, expression: Condition | Result) => void,
): void {
    const visitArguments = (context: string, args: Argument[] | undefined): void => {
        for (const argument of args ?? []) {
            const expression = argument.condition ?? argument.result
            if (expression) visit(context, argument.name, expression)
        }
    }

    for (const stateMachine of stateMachines) {
        const machineContext = `State machine \`${stateMachine.name}\``

        for (const state of stateMachine.states) {
            for (const implied of state.impliedConditions ?? []) {
                const stateContext = `${machineContext}: State \`${state.name}\` implied condition`
                visit(stateContext, implied.attribute, implied.condition)
            }
        }

        for (const precondition of stateMachine.defaultPreconditions ?? []) {
            visitArguments(`${machineContext}: Default precondition \`${precondition.state}\``, precondition.arguments)
        }

        for (const transition of stateMachine.transitions ?? []) {
            const transitionContext = formatTransitionContext(stateMachine.name, transition)
            for (const stateRef of transition.states ?? []) {
                visitArguments(transitionContext, stateRef.arguments)
            }
            visitArguments(transitionContext, transition.trigger.arguments)
            visitArguments(transitionContext, transition.result.arguments)
        }
    }
}

/**
 * [REQ-424] Restricts attribute-reference values (`valueIsReference`) to the sites that can carry
 * one: a transition result argument's `result`, and a condition using a scalar comparison
 * operator. A set, range, or unary condition compares against a fixed list of literals (or
 * against no value at all), which a reference — a name standing for another attribute's value —
 * cannot provide.
 *
 * @param stateMachines Parsed state-machine AST nodes.
 * @returns Nothing. Validation succeeds by not throwing.
 * @throws Error When a reference value appears on a non-scalar condition operator.
 */
export function validateReferenceOperators(stateMachines: StateMachine[]): void {
    forEachValueExpression(stateMachines, (context, attributeName, expression) => {
        if (!expression.valueIsReference) return
        // A `Result` carries no operator at all (REQ-415: always a plain equality assignment).
        if (!("operator" in expression)) return
        const operator = expression.operator
        if (SCALAR_CONDITION_OPERATORS.has(operator)) return
        throw new Error(
            `${context}: Argument \`${attributeName}\` references attribute \`${expression.value}\`, but operator ` +
            `\`${operator}\` compares against fixed literal value(s), which an attribute reference ` +
            `cannot provide (REQ-424).`,
        )
    })
}

/**
 * [REQ-425] Ensures every attribute-reference value — a condition's as well as a result's — names
 * a data attribute declared somewhere in the AST: in any state machine, not only the one owning
 * the reference, since a reference resolves against whichever machine actually declares that
 * name.
 *
 * Runs on the complete AST (after `completeStateMachines`), so every attribute inferred from usage
 * is already present in each machine's `data` map.
 *
 * @param stateMachines Parsed state-machine AST nodes.
 * @returns Nothing. Validation succeeds by not throwing.
 * @throws Error When a reference value names an attribute declared nowhere in the AST.
 */
export function validateReferenceTargets(stateMachines: StateMachine[]): void {
    const allAttributeNames = new Set<string>()
    for (const stateMachine of stateMachines) {
        for (const attributeName of Object.keys(stateMachine.data ?? {})) {
            allAttributeNames.add(attributeName.toLowerCase())
        }
        for (const row of stateMachine.dataExampleValues ?? []) {
            for (const attributeName of Object.keys(row)) {
                allAttributeNames.add(attributeName.toLowerCase())
            }
        }
    }

    forEachValueExpression(stateMachines, (context, attributeName, expression) => {
        if (!expression.valueIsReference) return
        const referencedName = typeof expression.value === "string" ? expression.value : ""
        if (allAttributeNames.has(referencedName.toLowerCase())) return
        throw new Error(
            `${context}: Argument \`${attributeName}\` references attribute \`${expression.value}\`, but no state ` +
            `machine declares a data attribute by the name \`${expression.value}\` (REQ-425).`,
        )
    })
}

/**
 * [REQ-406] Ensures every state trigger resolves to a source transition. A trigger naming a state
 * that transitions do produce, but whose arguments none of those transitions satisfies, leaves
 * the transition without a cause: nothing in the model can make it fire.
 *
 * The check follows the whole expansion chain, so a trigger that resolves only through a source
 * whose own trigger is unresolvable is reported too.
 *
 * @param stateMachines Parsed state-machine AST nodes.
 * @returns Nothing. Validation succeeds by not throwing.
 * @throws Error When a state trigger names a produced state but no producing transition can act
 *   as its source.
 */
export function validateStateTriggerResolution(stateMachines: StateMachine[]): void {
    const ownership = buildStateOwnership(stateMachines)
    const taggedTransitions = buildTaggedTransitions(stateMachines)

    for (const tagged of taggedTransitions) {
        const unresolvable = findUnresolvableTrigger(tagged.transition, taggedTransitions, ownership)
        if (!unresolvable) continue

        const owner = taggedTransitions.find((candidate) => candidate.transition === unresolvable.transition)
        const attributeNames = (unresolvable.trigger.arguments ?? []).map((argument) => `\`${argument.name}\``)
        const argumentWord = attributeNames.length === 1 ? "argument" : "arguments"
        const attributeList = attributeNames.length > 0 ? attributeNames.join(", ") : "its arguments"
        throw new Error(
            `${formatTransitionContext(owner?.stateMachineName ?? "<unknown>", unresolvable.transition)}: ` +
            `State trigger \`${unresolvable.trigger.name}\` names a state that is produced elsewhere, but no ` +
            `producing transition satisfies the trigger's ${argumentWord} ${attributeList} (REQ-406).`,
        )
    }
}

/**
 * [REQ-411] Raises an error when a transition references argument(s) but no state machine taking
 * part in its context — its own, those owning its precondition states, and those reached along
 * its state-trigger expansion chain — defines a non-empty `dataExampleValues` table.
 *
 * The participating machines and the chain resolution come from the shared expansion resolver
 * (`expand.ts`), so this check and every consumer agree on which machines a transition draws on.
 *
 * @param stateMachines Parsed state-machine AST nodes.
 * @returns Nothing. Validation succeeds by not throwing.
 * @throws Error When an argument-bearing transition has no reachable `dataExampleValues` rows.
 */
export function validateExampleValuesPresence(stateMachines: StateMachine[]): void {
    const ownership = buildStateOwnership(stateMachines)
    const taggedTransitions = buildTaggedTransitions(stateMachines)

    for (const stateMachine of stateMachines) {
        const defaultPreconditions = stateMachine.defaultPreconditions ?? []
        for (const transition of stateMachine.transitions ?? []) {
            if (!transitionReferencesArguments(transition, defaultPreconditions)) continue

            const exampleValues = effectiveExampleValues(
                stateMachines, stateMachine, transition, defaultPreconditions, ownership, taggedTransitions,
            )
            if (exampleValues.length > 0) continue

            throw new Error(
                `State machine \`${stateMachine.name}\`: ` +
                    `${transition.id ? `transition \`${transition.id}\`` : "Anonymous transition"} references argument(s), but the machine's ` +
                    `dataExampleValues table is empty or absent (REQ-411).`,
            )
        }
    }
}

