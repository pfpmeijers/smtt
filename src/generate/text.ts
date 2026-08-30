import type { Argument, StateRef, Trigger } from "../parse"
import type { ExampleColumn } from "./examples"
import { attributePlaceholderName, validateArgument } from "./arguments"

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
    parts.push(`"<${attributePlaceholderName(argument, isResult)}>"`)
    if (argument.postQualifier) parts.push(argument.postQualifier)
    if (argument.suffix) parts.push(argument.suffix)

    return (isFirst ? " " : ", ") + parts.join(" ")
}

/**
 * Render all arguments of a state or trigger as one inline text, or `""` when there are none.
 *
 * @param stateMachineName Name of the state machine owning the arguments, for error context.
 * @param args Arguments to render.
 * @param isResult Whether the arguments belong to the transition result.
 * @returns The rendered argument text.
 */
function renderArguments(stateMachineName: string, args: Argument[] | undefined, isResult: boolean): string {
    return (args ?? [])
        .map((argument, index) => renderArgument(stateMachineName, argument, index === 0, isResult))
        .join("")
}

/**
 * Render a state references as step text, e.g. `user authenticated as "<email address>"`.
 *
 * @param stateMachineName Name of the state machine owning the transition, for error context.
 * @param stateRef State references to render.
 * @param isResult Whether the state references belongs to the transition result.
 * @returns The rendered state references text.
 */
export function stateRefText(stateMachineName: string, stateRef: StateRef, isResult = false): string {
    return `${stateRef.name}${renderArguments(stateMachineName, stateRef.arguments, isResult)}`
}

/**
 * Render a trigger as step text, e.g. `signed in with "<email address>"`.
 *
 * @param stateMachineName Name of the state machine owning the transition, for error context.
 * @param trigger Trigger to render.
 * @returns The rendered trigger text.
 */
export function triggerText(stateMachineName: string, trigger: Trigger): string {
    return `${trigger.name}${renderArguments(stateMachineName, trigger.arguments, false)}`
}

// --- Step generation ---

const STEP_PLACEHOLDER_RE = /"<([^>]+)>"/g
const STEP_PREFIX_RE = /^(?:initially|expect)\s+/i
const TRAILING_CONNECTORS_RE = /\s+(?:about|as|into|so|to|from|for|under|in|on|with|of|at|by|not)\s*$/i

/**
 * Convert a phrase into camelCase.
 *
 * @param text Text to convert.
 * @returns The camelCase representation.
 */
export function toCamelCase(text: string): string {
    return text.split(/\s+/).filter((word) => word.length > 0).map((word, index) => {
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
 * Keep only placeholder parameters that correspond to generated example columns.
 *
 * @param rawParams Parameters extracted from the step text.
 * @param exampleColumns Example columns available for the transition.
 * @returns Parameters that have matching example columns, in source order.
 */
export function resolveBaseParams(rawParams: string[], exampleColumns: ExampleColumn[]): string[] {
    const allowed = new Set(exampleColumns.map((column) => toCamelCase(column.name)))
    return rawParams.filter((param) => allowed.has(param))
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

// --- Scenario labels ---

const QUOTED_SEGMENT = /"[^"]*"/g
const VALUE_LITERAL_CONTEXT = /(?:^|\s)(?:=|<>|>|<|>=|<=|as|not as|in|not in|in range|not in range)\s*$/

/**
 * Lower case a scenario label while preserving the casing of quoted condition value literals
 * (REQ-028). Name tokens and `"<placeholder>"` references are lower cased; a quoted literal
 * directly following a comparison operator keeps its original casing, as it denotes data
 * rather than a name.
 *
 * Examples: `Item Available` → `item available`; `status as "Active"` → `status as "Active"`;
 * `Item "<Count>"` → `item "<count>"`.
 *
 * @param text Scenario label text to transform.
 * @returns The lower-cased label with quoted value literals preserved.
 */
export function lowerCaseLabelPreservingValueLiterals(text: string): string {
    let result = ""
    let lastIndex = 0
    for (const match of text.matchAll(QUOTED_SEGMENT)) {
        const start = match.index ?? 0
        const quoted = match[0]
        const prefix = text.slice(lastIndex, start)
        const inner = quoted.slice(1, -1)
        const isPlaceholder = inner.startsWith("<") && inner.endsWith(">")

        result += prefix.toLowerCase()
        result += !isPlaceholder && VALUE_LITERAL_CONTEXT.test(prefix) ? quoted : `"${inner.toLowerCase()}"`
        lastIndex = start + quoted.length
    }
    return result + text.slice(lastIndex).toLowerCase()
}
