import * as fs from "fs"
import * as path from "path"
import { fileURLToPath } from "url"
import Ajv, { type ErrorObject, type ValidateFunction } from "ajv"
import type { Argument, Condition, DefaultPrecondition, Result, StateMachine, Transition } from "./sm.ast.d"
import { buildTaggedTransitions, collectChainStateMachineNames, findUnresolvableTrigger } from "./expand"
import { pinnedLiteral } from "./conditions"
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
    validateResultArgumentSuffixes(stateMachines)

    // [REQ-406/REQ-411] Business-rule checks performed after schema validation
    // succeeds, since they rely on `data` actually conforming to the
    // `StateMachine[]` shape. Trigger resolution runs first: a transition whose
    // trigger has no cause would otherwise be reported for the example values it
    // could not reach.
    validateStateTriggerResolution(stateMachines)
    validateExampleValuesPresence(stateMachines)
    validateResultSatisfiesTargetState(stateMachines)
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
            "Value combinations",
            stateMachine.dataValueCombinations ?? [],
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

                const rows = contributingMachine.dataValueCombinations ?? []
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
    "=", "<>", "<", ">", "<=", ">=", "as",
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
        for (const row of stateMachine.dataValueCombinations ?? []) {
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

/** A literal value: a quoted string, a backticked attribute reference, or a number. */
const VALUE_LITERAL = String.raw`(?:"[^"]*"|\`[^\`]*\`|-?\d+(?:\.\d+)?)`

/**
 * A result argument suffix that is really a condition in disguise (REQ-443): a comparison operator
 * followed by a value, or a bare presence check. Anchored at both ends, so descriptive prose that
 * merely starts with an operator word — `as shown`, `in cart` — is not mistaken for one.
 */
const CONDITION_SHAPED_SUFFIX = new RegExp(
    "^(?:" +
    String.raw`(?:as|is not|are not|is|are)\s+${VALUE_LITERAL}` +
    String.raw`|(?:>=|<=|<>|=|>|<)\s*${VALUE_LITERAL}` +
    String.raw`|(?:is\s+)?undefined|defined` +
    ")$",
    "i",
)

/**
 * [REQ-443] Raises an error when a transition result's argument carries a condition-shaped suffix.
 *
 * A result expresses an assignment and nothing else (`set to <value>`), so a comparison written in
 * a result position — `` `policies` as "approved" `` — matches no result rule and is absorbed by
 * the argument's free-text `suffix` instead. The author writes the same phrase that carries real
 * semantics in a precondition, and it silently degrades to decoration: it constrains no row,
 * binds no value, and the generated step asserts nothing about the attribute.
 *
 * Every violation is reported at once rather than one per run, since a model that adopted the
 * spelling tends to repeat it across many transitions.
 *
 * @param stateMachines Parsed state-machine AST nodes.
 * @returns Nothing. Validation succeeds by not throwing.
 * @throws Error When any result argument's suffix reads as a condition.
 */
export function validateResultArgumentSuffixes(stateMachines: StateMachine[]): void {
    const violations: string[] = []
    for (const stateMachine of stateMachines) {
        for (const transition of stateMachine.transitions ?? []) {
            for (const argument of transition.result.arguments ?? []) {
                const suffix = argument.suffix?.trim()
                if (!suffix || !CONDITION_SHAPED_SUFFIX.test(suffix)) continue
                violations.push(
                    `  - ${formatTransitionContext(stateMachine.name, transition)}: result argument ` +
                    `\`${argument.name}\` carries \`${suffix}\`, in state \`${transition.result.name}\``,
                )
            }
        }
    }
    if (violations.length === 0) return
    throw new Error(
        `A transition result states an assignment, not a comparison, so the following ` +
        `condition(s) parse as descriptive suffix text and constrain nothing:\n` +
        `${violations.join("\n")}\n` +
        `Write \`set to <value>\` to assign the value, or move the comparison to an implied ` +
        `condition on the target state (REQ-443).`,
    )
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
 * its state-trigger expansion chain — defines a non-empty `dataValueCombinations` table.
 *
 * The participating machines and the chain resolution come from the shared expansion resolver
 * (`expand.ts`), so this check and every consumer agree on which machines a transition draws on.
 *
 * @param stateMachines Parsed state-machine AST nodes.
 * @returns Nothing. Validation succeeds by not throwing.
 * @throws Error When an argument-bearing transition has no reachable `dataValueCombinations` rows.
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
                    `dataValueCombinations table is empty or absent (REQ-411).`,
            )
        }
    }
}

// --- Result vs. target state (REQ-433) ---

/**
 * What a transition leaves an attribute holding once it has fired. `defined` covers a value that
 * is certainly present but not statically known (an attribute reference); `unknown` means nothing
 * in the transition determines it, so no conclusion may be drawn.
 */
type PostValue =
    | { kind: "undefined" }
    | { kind: "literal", value: string }
    | { kind: "defined" }
    | { kind: "unknown" }

/** Presence a condition establishes for the attribute it constrains, when it establishes one. */
function presenceOfCondition(condition: Condition): PostValue {
    switch (condition.operator) {
        case "undefined":
            return { kind: "undefined" }
        case "defined":
            return { kind: "defined" }
        // A literal pin fixes the value; a reference-valued `=` or `as` still leaves it present,
        // since the row is dropped when the referenced value is missing.
        case "=":
        case "as": {
            const literal = pinnedLiteral(condition)
            return literal === undefined ? { kind: "defined" } : { kind: "literal", value: literal }
        }
        default:
            return { kind: "unknown" }
    }
}

/**
 * What the transition's own result assigns to `attribute`, if it assigns anything.
 *
 * @param transition Transition to read.
 * @param attribute Attribute name, lower-cased.
 * @returns The assigned value, or `undefined` when the result does not mention the attribute.
 */
function assignedPostValue(transition: Transition, attribute: string): PostValue | undefined {
    for (const argument of transition.result.arguments ?? []) {
        if (argument.name.toLowerCase() !== attribute) continue
        const result = argument.result
        if (!result) continue
        if (result.value === undefined) return { kind: "undefined" }
        if (result.valueIsReference) return { kind: "defined" }
        return { kind: "literal", value: result.value }
    }
    return undefined
}

/**
 * What the transition's preconditions establish for `attribute`, for the case where the result
 * assigns nothing and the value therefore carries over.
 *
 * Both the transition's own state arguments and the implied conditions of the states it names are
 * consulted. Facts that disagree yield `unknown`: the attribute's presence is then not something
 * this transition settles, and nothing may be reported about it.
 *
 * @param transition Transition to read.
 * @param attribute Attribute name, lower-cased.
 * @param impliedIndex Implied conditions declared per state.
 * @returns The carried-over value, and the state that established it when there is one.
 */
function carriedPostValue(
    transition: Transition,
    attribute: string,
    impliedIndex: Record<string, { attribute: string, condition: Condition }[]>,
): { value: PostValue, source?: string } {
    let settled: PostValue | undefined
    let source: string | undefined
    const consider = (candidate: PostValue, from: string): void => {
        if (candidate.kind === "unknown") return
        if (settled === undefined) {
            settled = candidate
            source = from
            return
        }
        if (settled.kind !== candidate.kind) settled = { kind: "unknown" }
    }

    for (const stateRef of transition.states ?? []) {
        for (const argument of stateRef.arguments ?? []) {
            if (argument.name.toLowerCase() !== attribute || !argument.condition || argument.modifier) continue
            consider(presenceOfCondition(argument.condition), `\`${stateRef.name}\``)
        }
        for (const implied of impliedIndex[stateRef.name.toLowerCase()] ?? []) {
            if (implied.attribute.toLowerCase() !== attribute) continue
            consider(presenceOfCondition(implied.condition), `\`${stateRef.name}\``)
        }
    }
    return { value: settled ?? { kind: "unknown" }, source }
}

/** Describe a post value for an error message. */
function describePostValue(value: PostValue): string {
    switch (value.kind) {
        case "undefined": return "leaves it undefined"
        case "literal": return `sets it to "${value.value}"`
        default: return "leaves it defined"
    }
}

/**
 * Whether `value` breaks `condition`. Only conclusions that hold statically are reported: an
 * unknown value, a modifier-bearing condition, or an operator whose outcome depends on the row
 * never yields a violation.
 */
function violates(value: PostValue, condition: Condition): boolean {
    if (value.kind === "unknown") return false
    switch (condition.operator) {
        case "defined":
            return value.kind === "undefined"
        case "undefined":
            return value.kind !== "undefined"
        case "=":
        case "as": {
            const literal = pinnedLiteral(condition)
            if (literal === undefined) return false
            if (value.kind === "undefined") return true
            return value.kind === "literal" && literal !== value.value
        }
        default:
            return false
    }
}

/**
 * [REQ-433] Raises an error when a transition's result cannot satisfy an implied condition its
 * own target state declares — the state says an attribute is `defined`, say, while the transition
 * neither sets it nor inherits a value for it.
 *
 * A state's implied conditions describe every occurrence of that state, so a transition that
 * lands in it owes them. Without this check the contradiction only surfaces much later, as an
 * empty examples table in some unrelated machine that expanded through the transition — or not at
 * all, when the attribute happens to go unused.
 *
 * Only statically decidable cases are reported: an attribute whose post-transition value nothing
 * determines is left alone, as is a sameness (`as`) to another attribute, which binds per row
 * rather than demands. A sameness to a literal pins one value and is checked like `=`.
 *
 * On the complete AST, a target's literal `=` or `undefined` implied condition is rarely the
 * source of a reported violation any more: completion (REQ-434) already gives a transition that
 * leaves the attribute otherwise unassigned an explicit result matching that concrete value. This
 * check still catches the case REQ-434 deliberately leaves alone — a transition whose own
 * explicit result contradicts the target — and remains the only check for `defined` targets, the
 * one implied condition that pins no single concrete value for REQ-434 to assign.
 *
 * @param stateMachines Parsed state-machine AST nodes.
 * @returns Nothing. Validation succeeds by not throwing.
 * @throws Error When a transition result contradicts its target state's own declaration.
 */
export function validateResultSatisfiesTargetState(stateMachines: StateMachine[]): void {
    const impliedIndex: Record<string, { attribute: string, condition: Condition }[]> = {}
    for (const stateMachine of stateMachines) {
        for (const state of stateMachine.states) {
            if (!state.impliedConditions?.length) continue
            const key = state.name.toLowerCase()
            if (!(key in impliedIndex)) impliedIndex[key] = state.impliedConditions
        }
    }

    for (const stateMachine of stateMachines) {
        for (const transition of stateMachine.transitions ?? []) {
            const target = transition.result
            for (const implied of impliedIndex[target.name.toLowerCase()] ?? []) {
                // A sameness to another attribute is satisfied per row by construction, never owed
                // by the transition; a sameness to a literal is a pin like `=` and is checked.
                if (implied.condition.operator === "as" && implied.condition.valueIsReference) continue

                const attribute = implied.attribute.toLowerCase()
                const assigned = assignedPostValue(transition, attribute)
                const { value, source } = assigned
                    ? { value: assigned, source: undefined }
                    : carriedPostValue(transition, attribute, impliedIndex)
                if (!violates(value, implied.condition)) continue

                const requirement = pinnedLiteral(implied.condition) !== undefined
                    ? `\`${implied.attribute}\` ${implied.condition.operator} ${JSON.stringify(implied.condition.value)}`
                    : `\`${implied.attribute}\` ${implied.condition.operator}`
                const cause = assigned
                    ? `the transition's own result ${describePostValue(value)}`
                    : `the transition does not set it and ${describePostValue(value)}${source ? ` (carried over from ${source})` : ""}`
                throw new Error(
                    `State machine \`${stateMachine.name}\`: ` +
                    `${transitionLabel(transition)} results in \`${target.name}\`, which declares ` +
                    `${requirement}, but ${cause}. Set \`${implied.attribute}\` in the result, or ` +
                    `relax the declaration on \`${target.name}\` (REQ-433).`,
                )
            }
        }
    }
}

/** Label a transition by its id for an error message. */
function transitionLabel(transition: Transition): string {
    return transition.id ? `transition \`${transition.id}\`` : "anonymous transition"
}

