/**
 * State machine parser.
 *
 * Compiles `sm.ohm` and converts a `.state-machine.md`
 * source into a `StateMachine` AST. Identifiers are read generically as
 * backticked tokens; semantic classification (state vs event triggers, text vs
 * numeric attributes, value-to-attribute alignment, cross-machine resolution)
 * is performed in a later post-parse step.
 */

import * as fs from "fs"
import * as path from "path"
import { fileURLToPath } from "url"
import { grammar, Grammar } from "ohm-js"

import { createSemantics, saveStateMachines } from "./sm.ast"
import type { StateMachine, Trigger } from "./sm.ast.d"
import { completeStateMachines } from "./complete"
import { validateStateMachines } from "./validate"

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const grammarSource = fs.readFileSync(path.resolve(currentDir, "sm.ohm"), "utf-8")
const stateMachineGrammar: Grammar = grammar(grammarSource)
const semantics = createSemantics(stateMachineGrammar)

/**
 * Creates a parse error with a formatted message.
 *
 * @param sourceFile The source file path that failed to parse.
 * @param message The error message details.
 * @returns An Error object with a formatted stack trace set to the error message.
 */
function createParseError(sourceFile: string, message: string): Error {
    const parseError = new Error(`Parsing \`${sourceFile}\` failed.\n${message}`)
    parseError.stack = parseError.message
    return parseError
}

/**
 * Classifies every trigger in all parsed state machines as either
 * `type: "state"` (when the trigger name matches a known state) or
 * `type: "event"` (all other triggers). Mutates the trigger objects in place.
 *
 * Must be called after ALL machines are parsed so that inter-machine state
 * names are visible when resolving triggers defined in peer machines.
 *
 * @param stateMachines Array of parsed state machines to classify.
 * @returns `undefined`. Modifies trigger objects in place.
 */
function classifyTriggers(stateMachines: StateMachine[]): void {
    const stateNames = new Set<string>()
    for (const machine of stateMachines) {
        for (const state of machine.states) {
            stateNames.add(state.name.toLowerCase())
        }
    }

    function classifyOne(trigger: Trigger): void {
        const raw = trigger as unknown as Record<string, unknown>
        raw.type = stateNames.has((raw.name as string).toLowerCase()) ? "state" : "event"
    }

    for (const machine of stateMachines) {
        for (const transition of machine.transitions ?? []) {
            classifyOne(transition.trigger)
        }
        for (const entry of machine.impossible?.defined ?? []) {
            classifyOne(entry.trigger)
        }
        for (const entry of machine.irrelevant ?? []) {
            classifyOne(entry.trigger)
        }
    }
}

/**
 * Recursively collects all `.state-machine.md` files from a directory.
 *
 * @param dir The directory path to search recursively.
 * @returns Array of absolute file paths to all `.state-machine.md` files found.
 */
export function collectFiles(dir: string): string[] {
    let results: string[] = []
    const entries = fs.readdirSync(dir)
    for (const entry of entries) {
        const fullPath = path.join(dir, entry)
        const stat = fs.statSync(fullPath)
        if (stat && stat.isDirectory()) {
            results = results.concat(collectFiles(fullPath))
        } else if (entry.endsWith(".state-machine.md")) {
            results.push(fullPath)
        }
    }
    return results
}

/**
 * Parses one state machine source string into an AST.
 *
 * @param source The state machine source code string to parse.
 * @param sourceFile Optional file path for error reporting. Defaults to `"<unknown>"`.
 * @returns Parsed `StateMachine` AST object.
 * @throws Error if parsing fails or if semantics transformation fails.
 */
export function parseSource(source: string, sourceFile = "<unknown>"): StateMachine {
    const matchResult = stateMachineGrammar.match(source, "stateMachineFile")
    if (matchResult.failed()) {
        throw createParseError(sourceFile, matchResult.message ?? "")
    }

    try {
        return semantics(matchResult).toAST() as StateMachine
    } catch (error) {
        throw createParseError(sourceFile, error instanceof Error ? error.message : String(error))
    }
}

/**
 * Parses every `.state-machine.md` file in a directory into a `StateMachine` AST.
 *
 * @param inputDir The directory path containing `.state-machine.md` files.
 * @param astFile Optional file path to write the combined JSON AST result.
 * @returns Array of parsed and validated `StateMachine` objects, sorted by source file path.
 */
export function parse(inputDir: string, astFile?: string): StateMachine[] {
    const sourceFiles = collectFiles(inputDir).sort((firstFile, secondFile) => firstFile.localeCompare(secondFile))

    const stateMachines = sourceFiles.map(sourceFile => {
        const source = fs.readFileSync(sourceFile, "utf8")
        const stateMachine = parseSource(source, sourceFile)
        stateMachine.source = path.resolve(sourceFile)
        return stateMachine
    })
    classifyTriggers(stateMachines)
    // FIXME: Expect a validate-minimal-AST here.
    completeStateMachines(stateMachines)
    validateStateMachines(stateMachines)
    if (astFile) {
        const astDir = path.dirname(astFile)
        fs.mkdirSync(astDir, { recursive: true })
        saveStateMachines(astFile, stateMachines)
    }
    return stateMachines
}
