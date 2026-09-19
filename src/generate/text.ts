import type { Argument, ImpliedConditionsIndex, StateRef, Trigger } from "../parse"
import type { ExampleColumn } from "../parse"
import { attributePlaceholderName, isRedundantPinnedResult, validateArgument } from "../parse"

// --- File names ---

/**
 * Convert a state machine name into a feature file name: lower cased, with internal
 * whitespace replaced by hyphens (REQ-131).
 *
 * @param name State machine name to convert.
 * @returns The slugified file name.
 */
export function slugify(name: string): string {
    return name.toLowerCase().replace(/\s+/g, "-")
}

// --- States, triggers and arguments ---

/**
 * Render an argument as inline text appended to its owning state/trigger name (REQ-048/REQ-050).
 * The leading separator (a space for the first argument, `, ` for subsequent ones) is included.
 *
 * @param stateMachineName Name of the state machine owning the argument, for error context.
 * @param argument Argument to render.
 * @param isFirst Whether the argument is the first one of its owner.
 * @param isResult Whether the argument belongs to the transition result.
 * @throws Error When the argument combines a qualifier with a modifier.
 * @returns The rendered inline argument text.
 */
function renderArgument(stateMachineName: string, argument: Argument, isFirst: boolean, isResult: boolean): string {
    validateArgument(stateMachineName, argument)

    const parts: string[] = []
    if (argument.qualifier) parts.push(argument.qualifier)
    if (argument.preQualifier) parts.push(argument.preQualifier)
    if (argument.postQualifier) parts.push(argument.postQualifier)
    parts.push(`"<${attributePlaceholderName(argument, isResult)}>"`)
    if (argument.suffix) parts.push(argument.suffix)

    return (isFirst ? " " : ", ") + parts.join(" ")
}

/**
 * Render all arguments of a state or trigger as one inline text, or `""` when there are none.
 *
 * @param stateMachineName Name of the state machine owning the arguments, for error context.
 * @param stateRef State references owning the arguments, or `null` for a trigger.
 * @param args Arguments to render.
 * @param isResult Whether the arguments belong to the transition result.
 * @param impliedIndex Implied conditions per state name, for REQ-442 suppression.
 * @returns The rendered argument text.
 */
function renderArguments(
    stateMachineName: string,
    stateRef: StateRef | null,
    args: Argument[] | undefined,
    isResult: boolean,
    impliedIndex: ImpliedConditionsIndex,
): string {
    const rendered = (args ?? []).filter(
        (argument) => !(isResult && stateRef && isRedundantPinnedResult(stateRef, argument, impliedIndex)),
    )
    return rendered
        .map((argument, index) => renderArgument(stateMachineName, argument, index === 0, isResult))
        .join("")
}

/**
 * Render a state references as step text, e.g. `user authenticated as "<email address>"`.
 *
 * @param stateMachineName Name of the state machine owning the transition, for error context.
 * @param stateRef State references to render.
 * @param isResult Whether the state references belongs to the transition result.
 * @param impliedIndex Implied conditions per state name, used to suppress result arguments whose
 *   value the result state itself already pins (REQ-442).
 * @returns The rendered state references text.
 */
export function stateRefText(
    stateMachineName: string,
    stateRef: StateRef,
    isResult = false,
    impliedIndex: ImpliedConditionsIndex = {},
): string {
    return `${stateRef.name}${renderArguments(stateMachineName, stateRef, stateRef.arguments, isResult, impliedIndex)}`
}

/**
 * Render a trigger as step text, e.g. `signed in with "<email address>"`.
 *
 * @param stateMachineName Name of the state machine owning the transition, for error context.
 * @param trigger Trigger to render.
 * @returns The rendered trigger text.
 */
export function triggerText(stateMachineName: string, trigger: Trigger): string {
    return `${trigger.name}${renderArguments(stateMachineName, null, trigger.arguments, false, {})}`
}

// --- Step generation ---

const STEP_PLACEHOLDER_RE = /"<([^>]+)>"/g
const STEP_PREFIX_RE = /^(?:initially|expect)\s+/i
const TRAILING_CONNECTORS_RE =
    /\s+(?:about|on|as|for|from|into|of|so|to|under|with|using|at|by|over|within|outside|between|against|per|via|around|during|through)\s*$/i

const RESULTING_PREFIX_RE = /^resulting\s+/i

/**
 * Convert a phrase into camelCase, dropping a leading `resulting` prefix (REQ-101's `resulting
 * $attribute-name` column naming) so generated arg names read as the plain attribute name.
 *
 * @param text Text to convert.
 * @returns The camelCase representation.
 */
export function toCamelCase(text: string): string {
    return text.replace(RESULTING_PREFIX_RE, "").split(/\s+/).filter((word) => word.length > 0).map((word, index) => {
        if (index === 0) return word.toLowerCase()
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    }).join("")
}

/**
 * Replace quoted placeholders in step text with Cucumber `{string}` markers.
 *
 * @param text Step text containing quoted placeholders.
 * @returns Step text with Cucumber placeholders.
 */
export function toOutlinePattern(text: string): string {
    return text.replace(STEP_PLACEHOLDER_RE, "{string}")
}

/**
 * Extract placeholder names from a rendered step text.
 *
 * @param stepText Step text containing quoted placeholders.
 * @returns Placeholder names normalized to camelCase.
 */
export function getStepParams(stepText: string): string[] {
    return [...stepText.matchAll(STEP_PLACEHOLDER_RE)].map((match) => toCamelCase(match[1]))
}

/**
 * Keep only placeholder parameters that correspond to generated example columns, naming each by
 * its underlying attribute rather than its rendered column header: a modifier prefix (e.g.
 * `next`) distinguishes the `Examples:` column from its base attribute for a human reader, but
 * carries no semantic meaning for the step callback, so the param drops it (e.g. `next therapy
 * subject` becomes `therapySubject`, not `nextTherapySubject`).
 *
 * @param rawParams Parameters extracted from the step text.
 * @param exampleColumns Example columns available for the transition.
 * @returns Base-attribute param names for placeholders with a matching example column, in
 *   source order.
 */
export function resolveBaseParams(rawParams: string[], exampleColumns: ExampleColumn[]): string[] {
    const columnsByParamName = new Map(exampleColumns.map((column) => [toCamelCase(column.name), column]))
    return rawParams.flatMap((param) => {
        const column = columnsByParamName.get(param)
        return column ? [toCamelCase(column.sourceName)] : []
    })
}

const FIXTURE_PREFIXES: Record<"Given" | "When" | "Then", string> = {
    Given: "set",
    When: "make",
    Then: "expect",
}

/**
 * Derive a fixture function name from a rendered step phrase.
 *
 * @param keyword Step section keyword.
 * @param stepText Rendered step phrase, including the section-specific prefix.
 * @returns The fixture function name.
 */
export function fixtureNameFromStep(keyword: "Given" | "When" | "Then", stepText: string): string {
    let raw = stepText.replace(STEP_PREFIX_RE, "").trim()
    const placeholderIndex = raw.indexOf("{")
    if (placeholderIndex >= 0) {
        raw = raw.slice(0, placeholderIndex).trim()
    }
    raw = raw.replace(TRAILING_CONNECTORS_RE, "").trim()
    raw = raw.replace(/[^a-zA-Z0-9]+/g, " ").trim()

    const base = raw
        .split(/\s+/)
        .filter((word) => word.length > 0)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join("")

    return `${FIXTURE_PREFIXES[keyword]}${base}`
}
