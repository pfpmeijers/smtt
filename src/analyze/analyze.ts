/**
 * State machine static analyzer and reachability reporting orchestrator.
 */

import fs from "fs"
import path from "path"
import { loadStateMachines, parse } from "../parse"
import type { StateMachine } from "../parse"
import { computeInferredImpossibilities } from "../infer/impossibilities"
import { exploreStateSpace } from "./explore"
import { deriveInsights } from "./insights"
import {
    buildAllNormalizedTransitions,
    buildStateIndex,
    buildTransitionById,
    traceDependencies,
} from "./normalize"
import { buildMarkdownReport, buildReport } from "./report"
import type {
    AnalysisReport,
    AnalyzeOptions,
    AnalyzeResult,
    DependencyTreeNode,
    ImpossibilityMode,
} from "./types"

export { buildMarkdownReport } from "./report"

// --- Analysis orchestration ---

/**
 * Analyzes state machine ASTs and returns a structured analysis report.
 * Performs no file I/O and is suitable for programmatic invocation and unit tests.
 *
 * @param parseResult State machine AST container with `stateMachines` array.
 * @param options Exploration options including `maxStates`, `externalOnly`, `impossibilityMode`, and `astFile`.
 * @returns Comprehensive analysis report.
 */
export function analyzeStateMachines(
    parseResult: { stateMachines?: StateMachine[]; machines?: StateMachine[] },
    options: {
        maxStates?: number
        externalOnly?: boolean
        impossibilityMode?: ImpossibilityMode
        astFile?: string
    } = {}
): AnalysisReport {
    const stateMachines = parseResult.stateMachines ?? parseResult.machines ?? []
    const stateToStateMachine = buildStateIndex(stateMachines)
    const normalizedTransitions = buildAllNormalizedTransitions(stateMachines, stateToStateMachine)
    const transitionById = buildTransitionById(normalizedTransitions)

    const dependencyTrees: Record<string, DependencyTreeNode> = {}
    for (const transition of normalizedTransitions) {
        dependencyTrees[transition.id] = traceDependencies(
            transition.id,
            normalizedTransitions,
            transitionById,
            []
        )
    }

    const explorationResult = exploreStateSpace(stateMachines, normalizedTransitions, options)
    const insights = deriveInsights(
        normalizedTransitions,
        stateMachines,
        explorationResult,
        dependencyTrees
    )
    return buildReport(insights, dependencyTrees, stateMachines, {
        impossibilityMode: options.impossibilityMode,
        astFile: options.astFile,
    })
}

/**
 * Loads and parses state machine markdown files from a directory.
 *
 * @param inputPath Path to a state machine markdown file or containing directory.
 * @returns Parsed state machines and resolved source directory path.
 */
function loadParseResult(
    inputPath: string
): { result: { stateMachines: StateMachine[] }; sourceDir: string } {
    const sourceDir = fs.statSync(inputPath).isDirectory()
        ? inputPath
        : path.dirname(inputPath)
    const result = { stateMachines: parse(sourceDir) }
    return { result, sourceDir }
}

/**
 * Validates strict mode assertions, throwing an error if any critical anomalies exist.
 *
 * @param report Analysis report to validate.
 */
function validateStrictMode(report: AnalysisReport): void {
    const hasIssues =
        report.summary.dead > 0 ||
        report.summary.unhandledTriggers > 0 ||
        report.summary.cycles > 0 ||
        report.summary.missingPreconditions > 0

    if (hasIssues) {
        throw new Error(
            `Strict mode: \`${report.summary.dead}\` dead transitions, ` +
                `\`${report.summary.unhandledTriggers}\` unhandled triggers, ` +
                `\`${report.summary.cycles}\` cycles, ` +
                `\`${report.summary.missingPreconditions}\` missing preconditions.`
        )
    }
}

/**
 * Runs full analysis for a state-machine directory and writes both parse JSON and Markdown report artifacts.
 *
 * @param inputPath Directory path containing `*.state-machine.md` files or AST JSON directory.
 * @param options Analysis options controlling output file paths, state limits, AST loading, inference, and strict validation.
 * @returns Output artifact paths and structured analysis report.
 */
export function analyze(
    inputPath: string,
    options: AnalyzeOptions = {}
): AnalyzeResult {
    const {
        astFile,
        infer = false,
        outputFile,
        maxStates = 100000,
        externalOnly = false,
        strictMode = false,
    } = options

    if (astFile && infer) {
        throw new Error("Options --infer and --ast-file are mutually exclusive.")
    }

    let result: { stateMachines: StateMachine[] }
    let sourceDir: string
    let parseJsonPath: string
    let impossibilityMode: ImpossibilityMode

    if (astFile) {
        const resolvedAstPath = path.resolve(astFile)
        if (!fs.existsSync(resolvedAstPath)) {
            throw new Error(`AST JSON file not found: \`${resolvedAstPath}\``)
        }
        const stateMachines = loadStateMachines(resolvedAstPath)
        result = { stateMachines }
        sourceDir = path.dirname(resolvedAstPath)
        parseJsonPath = resolvedAstPath
        impossibilityMode = "inferred-ast"
    } else {
        const resolvedInputPath = path.resolve(inputPath)
        const parsed = loadParseResult(resolvedInputPath)
        result = parsed.result
        sourceDir = parsed.sourceDir

        if (infer) {
            const inferredByMachine = computeInferredImpossibilities(result.stateMachines)
            for (const stateMachine of result.stateMachines) {
                if (!stateMachine.impossible) {
                    stateMachine.impossible = { defined: [] }
                }
                stateMachine.impossible.inferred = inferredByMachine[stateMachine.name] ?? []
            }
            impossibilityMode = "inferred-new"
        } else {
            impossibilityMode = "defined-only"
        }

        const dirName = path.basename(sourceDir)
        parseJsonPath = path.join(sourceDir, `${dirName}.json`)
        fs.writeFileSync(parseJsonPath, JSON.stringify(result, null, 2), "utf8")
        console.log(`Written: \`${parseJsonPath}\``)
    }

    const dirName = path.basename(sourceDir)
    const report = analyzeStateMachines(result, {
        maxStates,
        externalOnly,
        impossibilityMode,
        astFile,
    })
    const mdOutputPath = outputFile
        ? path.resolve(outputFile)
        : path.join(sourceDir, `${dirName}.analysis.md`)

    fs.writeFileSync(mdOutputPath, buildMarkdownReport(report, sourceDir), "utf8")
    console.log(`Written: \`${mdOutputPath}\``)

    if (report.summary.truncated) {
        console.warn("WARN: state-space exploration truncated — increase --max-states for complete results.")
    }

    if (strictMode) {
        validateStrictMode(report)
    }

    return { parseJsonPath, mdOutputPath, report }
}

