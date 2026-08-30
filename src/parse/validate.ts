import * as fs from "fs"
import * as path from "path"
import { fileURLToPath } from "url"
import Ajv, { type ErrorObject, type ValidateFunction } from "ajv"
import type { Argument, Condition, DefaultPrecondition, StateMachine, Transition } from "./sm.ast.d"

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
    validateResultConditionOperators(stateMachines)

    // [REQ-163] Business-rule check performed after schema validation
    // succeeds, since it relies on `data` actually conforming to the
    // `StateMachine[]` shape.
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
 * Maps each state name (lower-cased) to the name of the machine that declares it.
 *
 * @param stateMachines Parsed state-machine AST nodes.
 * @returns Ownership map keyed by lower-cased state name.
 */
function buildOwnership(stateMachines: StateMachine[]): Record<string, string> {
    const ownership: Record<string, string> = {}
    for (const stateMachine of stateMachines) {
        for (const state of stateMachine.states) {
            const key = state.name.toLowerCase()
            if (!(key in ownership)) ownership[key] = stateMachine.name
        }
    }
    return ownership
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
    const ownership = buildOwnership(stateMachines)

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
    const ownership = buildOwnership(stateMachines)

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
    const ownership = buildOwnership(stateMachines)
    const machineByName = new Map(stateMachines.map((stateMachine) => [stateMachine.name, stateMachine]))
    const requiresTwoDistinctValues = new Set(["not", "other", "different", "unequal", "next", "previous"])
    const requiresNumericValues = new Set(["incremented", "decremented"])

    for (const stateMachine of stateMachines) {
        const defaultPreconditions = stateMachine.defaultPreconditions ?? []

        for (const transition of stateMachine.transitions ?? []) {
            const effectiveDefaults = getEffectiveDefaultPreconditions(transition, defaultPreconditions, ownership)
            const transitionArguments = collectTransitionArguments(transition, effectiveDefaults)
            const modifiedArguments = transitionArguments.filter((argument) => Boolean(argument.modifier))
            if (modifiedArguments.length === 0) continue

            const contributingNames = collectContributingMachineNames(
                stateMachine,
                transition,
                effectiveDefaults,
                ownership,
                stateMachines,
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

/**
 * [REQ-415] Restricts result-argument conditions to equality-style operators only.
 *
 * @param stateMachines Parsed state-machine AST nodes.
 * @returns Nothing. Validation succeeds by not throwing.
 * @throws Error When a result argument uses an unsupported condition operator.
 */
export function validateResultConditionOperators(stateMachines: StateMachine[]): void {
    const allowedOperators = new Set(["=", "as", "undefined"])

    for (const stateMachine of stateMachines) {
        for (const transition of stateMachine.transitions ?? []) {
            const transitionContext = formatTransitionContext(stateMachine.name, transition)
            for (const argument of transition.result.arguments ?? []) {
                const operator = argument.condition?.operator
                if (!operator || allowedOperators.has(operator)) continue

                throw new Error(
                    `${transitionContext}: Result argument \`${argument.name}\` has a non-equality condition operator ` +
                    `\`${operator}\`. Only \`=\`, \`as\`, and \`undefined\` are allowed on result arguments.`,
                )
            }
        }
    }
}

/**
 * Returns `true` when two argument arrays are structurally identical.
 *
 * @param a First argument array.
 * @param b Second argument array.
 * @returns `true` when both arrays are equivalent by item order and JSON structure.
 */
function argumentsMatch(a: Argument[] | undefined, b: Argument[] | undefined): boolean {
    const left = a ?? []
    const right = b ?? []
    if (left.length !== right.length) return false
    return left.every((arg, index) => JSON.stringify(arg) === JSON.stringify(right[index]))
}

/**
 * [REQ-161] Collects the names of every state machine that may contribute
 * `dataExampleValues` rows for `transition`: the owning machine itself, the
 * owning machines of any referenced default-precondition / explicit
 * transition states, and — for state-trigger transitions — the machines
 * reached by following the expansion chain (mirroring the generator's own
 * REQ-108/REQ-118 expansion-source resolution). This is a coarser,
 * approximate mirror of the generator's chain-following logic — it is meant
 * as an early, best-effort check; the generator's own REQ-157 check remains
 * the authoritative one.
 *
 * [REQ-164] Also raises an error when a state trigger has one or more
 * candidate source transitions matching by result state name, but none of
 * them satisfies the REQ-118 argument-matching rule — the trigger is
 * unresolvable, and this dedicated error takes precedence over the (possibly
 * unrelated/misleading) REQ-157/REQ-163 "missing dataExampleValues" error
 * that would otherwise surface for a different machine.
 *
 * @param stateMachine Owning machine for `transition`.
 * @param transition Transition whose contributing machines are being resolved.
 * @param defaultPreconditions Effective default preconditions for `transition`.
 * @param ownership Map of lower-cased state names to owning machine names.
 * @param stateMachines All available machines used for trigger-chain expansion.
 * @param visited Transitions already traversed to avoid recursion loops.
 * @param depth Current recursion depth guard.
 * @returns Set of machine names that may contribute value rows.
 */
function collectContributingMachineNames(
    stateMachine: StateMachine,
    transition: Transition,
    defaultPreconditions: DefaultPrecondition[],
    ownership: Record<string, string>,
    stateMachines: StateMachine[],
    visited: Set<Transition> = new Set(),
    depth = 0,
): Set<string> {
    const names = new Set<string>([stateMachine.name])
    for (const precondition of defaultPreconditions) {
        const owner = ownership[precondition.state.toLowerCase()]
        if (owner) names.add(owner)
    }
    for (const ref of transition.states ?? []) {
        const owner = ownership[ref.name.toLowerCase()]
        if (owner) names.add(owner)
    }

    if (transition.trigger.type === "state" && depth <= 10) {
        for (const source of stateMachines) {
            for (const sourceTransition of source.transitions ?? []) {
                if (sourceTransition === transition || visited.has(sourceTransition)) continue
                if (sourceTransition.result.name.toLowerCase() !== transition.trigger.name.toLowerCase()) continue
                if (!argumentsMatch(sourceTransition.result.arguments, transition.trigger.arguments)) continue
                visited.add(sourceTransition)
                names.add(source.name)
                const nested = collectContributingMachineNames(
                    source,
                    sourceTransition,
                    source.defaultPreconditions ?? [],
                    ownership,
                    stateMachines,
                    visited,
                    depth + 1,
                )
                nested.forEach((name) => names.add(name))
            }
        }
    }
    return names
}

/**
 * [REQ-164] Detects whether `transition`'s state-trigger expansion chain
 * contains an unresolvable state trigger — i.e. one or more candidate source
 * transitions match by result state name, but none of them satisfies the
 * REQ-118 argument-matching rule. When this is the case, the REQ-157/REQ-163
 * "missing dataExampleValues" check must defer to the generator's own,
 * dedicated REQ-164 error instead of raising a possibly-unrelated error here.
 *
 * @param transition Transition being analyzed.
 * @param stateMachines All available machines used for trigger-chain expansion.
 * @param visited Transitions already traversed to avoid recursion loops.
 * @param depth Current recursion depth guard.
 * @returns `true` when at least one state trigger in the chain is unresolvable.
 */
function hasUnresolvableStateTrigger(
    transition: Transition,
    stateMachines: StateMachine[],
    visited: Set<Transition> = new Set(),
    depth = 0,
): boolean {
    if (transition.trigger.type !== "state" || depth > 10) return false

    const nameMatches: Transition[] = []
    for (const source of stateMachines) {
        for (const sourceTransition of source.transitions ?? []) {
            if (sourceTransition === transition || visited.has(sourceTransition)) continue
            if (sourceTransition.result.name.toLowerCase() !== transition.trigger.name.toLowerCase()) continue
            nameMatches.push(sourceTransition)
        }
    }
    if (nameMatches.length === 0) return false

    const sources = nameMatches.filter((sourceTransition) =>
        argumentsMatch(sourceTransition.result.arguments, transition.trigger.arguments),
    )
    if (sources.length === 0) return true

    return sources.some((sourceTransition) => {
        visited.add(sourceTransition)
        return hasUnresolvableStateTrigger(sourceTransition, stateMachines, visited, depth + 1)
    })
}

/**
 * [REQ-163] Raises an internal-assertion error when a transition references
 * argument(s) but none of the machines in its references/expansion chain
 * (REQ-161) defines a non-empty `dataExampleValues` table — mirroring the
 * generator's own REQ-157 check, but performed as an earlier parser-side
 * validation pass.
 *
 * @param stateMachines Parsed state-machine AST nodes.
 * @returns Nothing. Validation succeeds by not throwing.
 * @throws Error When an argument-bearing transition has no reachable `dataExampleValues` rows.
 */
export function validateExampleValuesPresence(stateMachines: StateMachine[]): void {
    const ownership = buildOwnership(stateMachines)
    const byName = new Map(stateMachines.map((stateMachine) => [stateMachine.name, stateMachine]))

    for (const stateMachine of stateMachines) {
        const defaultPreconditions = stateMachine.defaultPreconditions ?? []
        for (const transition of stateMachine.transitions ?? []) {
            if (!transitionReferencesArguments(transition, defaultPreconditions)) continue

            // [REQ-164] An unresolvable state trigger takes precedence over
            // this check — defer to the generator's dedicated error rather
            // than raising a misleading REQ-157 error for a different machine.
            if (hasUnresolvableStateTrigger(transition, stateMachines)) continue

            const contributingNames = collectContributingMachineNames(
                stateMachine, transition, defaultPreconditions, ownership, stateMachines,
            )
            const hasExampleValues = [...contributingNames].some(
                (name) => (byName.get(name)?.dataExampleValues ?? []).length > 0,
            )
            if (hasExampleValues) continue

            throw new Error(
                `Invalid state machine "${stateMachine.name}": ` +
                    `${transition.id ? `transition "${transition.id}"` : "anonymous transition"} references argument(s), but the machine's ` +
                    `dataExampleValues table is empty or absent (REQ-157/REQ-163).`,
            )
        }
    }
}

