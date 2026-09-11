import type { Condition, DefaultPrecondition, StateMachine, StateRef, Transition } from "../parse"
import { canonicalModifier } from "./arguments"
import type { ExpansionSourceStep } from "./expansion"
import { buildEffectiveGivens } from "./givens"
import type { ImpliedConditionsIndex, StateOwnershipIndex } from "./ownership"

/** A row filter derived from an argument condition or an implied state condition. */
export interface FilterCondition {
    sourceName: string
    /** Original modifier text from source for error reporting. */
    sourceModifier?: string
    /** When set, derive this modifier on `sourceName` before evaluating the condition (REQ-143/REQ-144). */
    modifier?: string
    condition: Condition
    /** Human-readable label of the transition that declared this filter, e.g. `` `m`#039 ``, for diagnostics. */
    declaredBy?: string
}

/**
 * Render a filter condition as a short, human-readable clause for diagnostics, e.g.
 * `` `email address` undefined (declared on `painting status`#039) ``.
 *
 * @param filter Filter condition to describe.
 * @returns The rendered description.
 */
export function describeFilterCondition(filter: FilterCondition): string {
    const attr = filter.modifier ? `${filter.modifier} \`${filter.sourceName}\`` : `\`${filter.sourceName}\``
    const clause = ((): string => {
        switch (filter.condition.operator) {
            case "undefined":
                return `${attr} undefined`
            case "defined":
                return `${attr} defined`
            case "in range":
                return `${attr} in ${filter.condition.value}`
            case "not in range":
                return `${attr} not in ${filter.condition.value}`
            case "in":
            case "not in": {
                const values = Array.isArray(filter.condition.value) ? filter.condition.value : [filter.condition.value ?? ""]
                return `${attr} ${filter.condition.operator} (${values.join(", ")})`
            }
            case "as":
            case "not as":
                return `${attr} ${filter.condition.operator} \`${filter.condition.value}\``
            default:
                return `${attr} ${filter.condition.operator} ${filter.condition.value}`
        }
    })()
    return filter.declaredBy ? `${clause} (declared on ${filter.declaredBy})` : clause
}

// --- Validation ---

/**
 * Reject the non-canonical spelling of an "absent value" condition. The only valid way to
 * express that an attribute is absent is the unary `undefined` operator: any other operator
 * paired with an empty value can never match a row (REQ-075), so rejecting it here avoids
 * silently producing an empty examples table.
 *
 * @param stateMachineName Name of the state machine owning the condition, for error context.
 * @param attributeName Attribute name the condition applies to.
 * @param condition Condition to validate.
 * @throws Error When a non-`undefined` operator is combined with an empty value.
 */
export function validateCondition(stateMachineName: string, attributeName: string, condition: Condition): void {
    if (condition.operator === "undefined" || condition.operator === "defined") return
    const value = condition.value
    const isEmpty = value === "" || (Array.isArray(value) && value.every((entry) => entry === ""))
    if (isEmpty) {
        throw new Error(
            `State machine \`${stateMachineName}\`: Invalid condition for attribute ` +
            `\`${attributeName}\`: operator \`${condition.operator}\` cannot be used with an empty value. ` +
            `Use { operator: "undefined" } to match absent/empty values instead.`,
        )
    }
}

// --- Evaluation ---

/** Compare two values numerically when both are numeric, and textually otherwise. */
function equalsValue(value: string, expected: string): boolean {
    const numericValue = Number(value)
    const numericExpected = Number(expected)
    if (Number.isNaN(numericValue) || Number.isNaN(numericExpected)) return value === expected
    return numericValue === numericExpected
}

/** Evaluate an ordering operator; non-numeric operands never satisfy it (REQ-090). */
function compareNumeric(value: string, expected: string, operator: string): boolean {
    const numericValue = Number(value)
    const numericExpected = Number(expected)
    if (Number.isNaN(numericValue) || Number.isNaN(numericExpected)) return false
    switch (operator) {
        case ">": return numericValue > numericExpected
        case "<": return numericValue < numericExpected
        case ">=": return numericValue >= numericExpected
        case "<=": return numericValue <= numericExpected
        default: return false
    }
}

const RANGE_PATTERN = /^\s*([\[(])\s*([^,\s]+)\s*,\s*([^,\s]+)\s*([\])])\s*$/

/**
 * Evaluate range membership, e.g. `[1, 4)` meaning `1 <= value < 4` (REQ-092/REQ-093/REQ-094).
 *
 * @param value Row value to evaluate.
 * @param conditionValue Condition value to interpret as a range.
 * @returns Whether the value lies within the range, or `undefined` when the range notation or
 *   any operand is not numeric.
 */
function evaluateRangeMembership(value: string, conditionValue: Condition["value"]): boolean | undefined {
    const match = typeof conditionValue === "string" ? conditionValue.match(RANGE_PATTERN) : null
    if (!match) return undefined
    const [, openBracket, lowerText, upperText, closeBracket] = match
    const numericValue = Number(value)
    const lower = Number(lowerText)
    const upper = Number(upperText)
    if (Number.isNaN(numericValue) || Number.isNaN(lower) || Number.isNaN(upper)) return undefined
    return (openBracket === "[" ? numericValue >= lower : numericValue > lower)
        && (closeBracket === "]" ? numericValue <= upper : numericValue < upper)
}

/**
 * Evaluate a condition against a single example value (REQ-090 through REQ-096).
 * An empty or missing value counts as absent: it only satisfies the `undefined` operator (and
 * fails the `defined` operator) and never satisfies any comparison (REQ-074/REQ-075). Unsupported
 * or malformed conditions do not match.
 *
 * @param rawValue Row value to evaluate.
 * @param condition Condition to evaluate.
 * @returns Whether the row value satisfies the condition.
 */
export function evaluateCondition(rawValue: string | undefined, condition: Condition): boolean {
    const isAbsent = rawValue == null || rawValue === ""
    if (condition.operator === "undefined") return isAbsent
    if (condition.operator === "defined") return !isAbsent
    if (isAbsent) return false

    const value = rawValue as string
    const conditionValue = condition.value
    const scalar = Array.isArray(conditionValue) ? (conditionValue[0] ?? "") : (conditionValue ?? "")

    switch (condition.operator) {
        case "=": return equalsValue(value, scalar)
        case "<>": return !equalsValue(value, scalar)
        case "as": return value === scalar
        case "not as": return value !== scalar
        case "in": return Array.isArray(conditionValue) && conditionValue.includes(value)
        case "not in": return Array.isArray(conditionValue) && !conditionValue.includes(value)
        case ">":
        case "<":
        case ">=":
        case "<=": return compareNumeric(value, scalar, condition.operator)
        case "in range":
        case "not in range": {
            const inRange = evaluateRangeMembership(value, conditionValue)
            if (inRange === undefined) return false
            return condition.operator === "in range" ? inRange : !inRange
        }
        default: return false
    }
}

// --- Collection ---

/**
 * Row filters declared on a transition's own precondition state and trigger arguments
 * (REQ-069/REQ-087). Result arguments are excluded: their result values add columns instead.
 *
 * @param stateMachineName Name of the state machine owning the transition, for error context.
 * @param transition Transition whose own filters are being collected.
 * @returns Row filters extracted from the transition's own conditions.
 */
function collectOwnFilterConditions(stateMachineName: string, transition: Transition): FilterCondition[] {
    const args = [
        ...(transition.states ?? []).flatMap((stateRef) => stateRef.arguments ?? []),
        ...(transition.trigger.arguments ?? []),
    ]

    const declaredBy = `\`${stateMachineName}\`#${transition.id ?? "?"}`
    const filters: FilterCondition[] = []
    for (const argument of args) {
        const condition = argument.condition
        if (!condition) continue
        validateCondition(stateMachineName, argument.name, condition)
        const modifier = canonicalModifier(argument)
        filters.push({
            sourceName: argument.name, sourceModifier: argument.modifier,
            ...(modifier ? { modifier } : {}), condition, declaredBy,
        })
    }
    return filters
}

/**
 * Row filters of a transition and of every source transition along one specific expansion path's
 * source chain. Conditions across the chain combine as a conjunction: a row survives only when it
 * satisfies all of them (REQ-162).
 *
 * Scoped to a single path's `sourceChain` (REQ-170/REQ-171): a sibling expansion path's own
 * condition — e.g. one candidate source requiring an attribute to be undefined — must not filter
 * out rows for a path that never resolved through that source.
 *
 * @param stateMachineName Name of the state machine owning `transition`, for error context.
 * @param transition Transition to start the chain at.
 * @param sourceChain The resolved expansion path's own chain of source transitions.
 * @returns The chain-conjoined row filters.
 */
export function collectChainFilterConditions(
    stateMachineName: string,
    transition: Transition,
    sourceChain: ExpansionSourceStep[],
): FilterCondition[] {
    return [
        ...collectOwnFilterConditions(stateMachineName, transition),
        ...sourceChain.flatMap((step) => collectOwnFilterConditions(step.stateMachineName, step.transition)),
    ]
}

/**
 * Row filters contributed by the implied conditions of a transition's effective `Given` states
 * — explicit transition states, injected default preconditions and the implied initial state
 * (REQ-148/REQ-165/REQ-167).
 *
 * @param stateMachine State machine owning the transition.
 * @param transition Transition to collect the implied conditions for.
 * @param defaultPreconditions Default preconditions of the owning state machine.
 * @param ownership State ownership index.
 * @param impliedIndex Implied conditions declared per state.
 * @param availableAttributes Attribute names present in the effective examples table; implied
 *   conditions on any other attribute impose no filter (REQ-166).
 * @param injectedGivenStates States injected by the transition's own expansion path, if any —
 *   included so a path's expansion-contributed state also contributes its implied conditions.
 * @returns Filter conditions contributed by implied state conditions.
 */
export function collectImpliedFilterConditions(
    stateMachine: StateMachine,
    transition: Transition,
    defaultPreconditions: DefaultPrecondition[],
    ownership: StateOwnershipIndex,
    impliedIndex: ImpliedConditionsIndex,
    availableAttributes: ReadonlySet<string>,
    injectedGivenStates: StateRef[] = [],
): FilterCondition[] {
    const givens = buildEffectiveGivens(transition, defaultPreconditions, ownership, stateMachine, injectedGivenStates)
    return collectImpliedFilterConditionsForGivens(stateMachine.name, givens, impliedIndex, availableAttributes)
}

/**
 * Row filters contributed by the implied conditions of an already-computed set of `Given` states
 * (REQ-148/REQ-165/REQ-167) — the part of {@link collectImpliedFilterConditions} that doesn't
 * depend on re-deriving the effective givens itself, split out so a caller that already has its
 * own equivalent given-state list (e.g. the `generate --debug` report, which walks the expansion
 * chain independently) can reuse the exact same filter logic instead of re-implementing it.
 *
 * @param stateMachineName Name of the state machine owning the given states, for error context.
 * @param givens Effective `Given` states to collect implied conditions for.
 * @param impliedIndex Implied conditions declared per state.
 * @param availableAttributes Attribute names present in the effective examples table; implied
 *   conditions on any other attribute impose no filter (REQ-166).
 * @returns Filter conditions contributed by implied state conditions.
 */
export function collectImpliedFilterConditionsForGivens(
    stateMachineName: string,
    givens: StateRef[],
    impliedIndex: ImpliedConditionsIndex,
    availableAttributes: ReadonlySet<string>,
): FilterCondition[] {
    const filters: FilterCondition[] = []
    for (const stateRef of givens) {
        for (const implied of impliedIndex[stateRef.name.toLowerCase()] ?? []) {
            if (!availableAttributes.has(implied.attribute)) continue
            validateCondition(stateMachineName, implied.attribute, implied.condition)
            filters.push({
                sourceName: implied.attribute, condition: implied.condition,
                declaredBy: `\`${stateRef.name}\` (implied)`,
            })
        }
    }
    return filters
}


