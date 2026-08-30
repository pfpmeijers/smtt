import type { Argument } from "../parse"

// --- Modifiers ---

/** Modifier spellings that all denote the canonical `different` modifier (REQ-085). */
const DIFFERENT_MODIFIER_ALIASES = new Set(["different", "other", "not", "unequal"])

/** Canonical modifier name of the `not`/`other`/`different` family (REQ-085). */
export const DIFFERENT_MODIFIER = "different"

/**
 * Canonical modifier name of an argument.
 * Any `not`/`other`/`different` spelling collapses to `different` (REQ-085).
 *
 * @param argument Argument to inspect.
 * @returns The canonical modifier name, or `undefined` when the argument carries no modifier.
 */
export function canonicalModifier(argument: Argument): string | undefined {
    if (!argument.modifier) return undefined
    return DIFFERENT_MODIFIER_ALIASES.has(argument.modifier) ? DIFFERENT_MODIFIER : argument.modifier
}

/**
 * Derived `Examples:` column name of a modifier argument, e.g. `incremented count`
 * or `different email address` (REQ-078/REQ-082/REQ-085).
 *
 * @param argument Argument to inspect.
 * @returns The derived column name, or `undefined` when the argument carries no modifier.
 */
export function modifierColumnName(argument: Argument): string | undefined {
    const modifier = canonicalModifier(argument)
    return modifier ? `${modifier} ${argument.name}` : undefined
}

// --- Result conditions ---

/**
 * Derived `Examples:` column name holding the value of a result condition (REQ-101).
 *
 * @param attributeName Attribute name the derived column refers to.
 * @returns The rendered derived column name.
 */
export function resultingColumnName(attributeName: string): string {
    return `resulting ${attributeName}`
}

// --- Placeholders ---

/**
 * Attribute name referenced by an argument's step-text placeholder.
 * A modifier argument references its derived column (REQ-137), a result argument carrying a
 * condition references its `resulting ...` column (REQ-101), any other argument references
 * the base attribute name.
 *
 * @param argument Argument to render a placeholder for.
 * @param isResult Whether the argument belongs to the transition result.
 * @returns The placeholder column name used in step text.
 */
export function attributePlaceholderName(argument: Argument, isResult: boolean): string {
    const modifierName = modifierColumnName(argument)
    if (modifierName) return modifierName
    if (isResult && argument.condition) return resultingColumnName(argument.name)
    return argument.name
}

// --- Validation ---

/**
 * Verify that an argument does not combine a qualifier with a modifier: a qualifier is only
 * valid when no modifier is given (REQ-057).
 *
 * @param stateMachineName Name of the state machine owning the argument, for error context.
 * @param argument Argument to validate.
 * @throws Error When both a qualifier and a modifier are present.
 */
export function validateArgument(stateMachineName: string, argument: Argument): void {
    if (argument.qualifier && argument.modifier) {
        throw new Error(
            `State machine \`${stateMachineName}\`: Invalid argument \`${argument.name}\`: ` +
                `qualifier and modifier are mutually exclusive`,
        )
    }
}

// --- Comparison ---

/**
 * Structural signature of an argument list, used to compare argument lists for equality
 * and to de-duplicate state references.
 *
 * @param args Argument list to serialize.
 * @returns A stable signature for the argument list.
 */
export function argumentsSignature(args: Argument[] | undefined): string {
    return JSON.stringify(args ?? [])
}

