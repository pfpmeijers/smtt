/**
 * Unified CLI dispatcher for state-machine test tooling (smtt).
 *
 * Usage:
 *   tsx smtt.ts parse [--input-dir <dir>] [--ast-file <file>] [--strict]
 *   tsx smtt.ts infer [--input-dir <dir>] [--ast-file <file>] [--strict]
 *   tsx smtt.ts analyze [--input-dir <dir>] [--output-file <file>] [--max-states <n>] [--strict]
 *   tsx smtt.ts generate [--input-dir <dir>] [--ast-file <file>] [--output-dir <dir>]
 *   tsx smtt.ts renumber [--input-dir <dir>]
 *
 * Relative paths are resolved from `process.cwd()`.
 * When explicit flags are omitted, paths fall back to the constants in `common/dirs.ts`.
 *
 * Subcommands:
 *   `parse`:     Parse `*.state-machine.md` files recursively from `--input-dir`
 *                and emit AST JSON to `--ast-file`.
 *   `infer`:     Run `parse` first, then infer impossibilities and write them
 *                into `impossible.inferred` in the same JSON file (primarily
 *                used by analysis/reporting workflows).
 *   `analyze`:   Run static + BFS analysis and write a markdown analysis report.
 *                This command can consume inferred impossibilities.
 *   `generate`:  Run `parse` and generate feature files, step definitions,
 *                and fixture stubs into `--output-dir`.
 *   `renumber`:  Rewrite transition IDs in source markdown tables using stable
 *                global ordering by source file path and line number.
 */

import * as fs from "fs"
import * as path from "path"
import { STATE_MACHINES_DIR } from "./common/dirs"
import { parse } from "./parse"
import { infer } from "./infer"
import { analyze } from "./analyze"
import { generate } from "./generate"
import { renumber } from "./renumber"

// --- Argument parsing ---

const args = process.argv.slice(2)
const command = args.find(arg => !arg.startsWith("-"))

// --- Shared helpers ---

/** Reads a named flag value from an argument list, or returns `null` when absent. */
function flagValue(subArgs: string[], flag: string): string | null {
    const index = subArgs.indexOf(flag)
    return index >= 0 ? subArgs[index + 1] : null
}

/**
 * Resolves all canonical paths used by subcommands from CLI flags, with `process.cwd()` as
 * the base for relative paths.
 *
 * - `inputDir`:  Directory searched recursively for `*.state-machine.md` files.
 *                Defaults to `<cwd>/state-machines/`.
 * - `astFile`:   AST JSON output written by `parse` and consumed by `infer`/`generate`.
 *                Defaults to `<inputDir>/state-machines.json`.
 * - `outputDir`: Base directory under which `features/`, `steps/`, and `fixtures/` are created.
 *                Defaults to `process.cwd()`.
 *
 * Exits with an error when `inputDir` does not exist.
 */
function resolveCliPaths(subArgs: string[], commandName: string): { inputDir: string, astFile: string, outputDir: string } {
    const inputDirArg = flagValue(subArgs, "--input-dir")
    const inputDir = inputDirArg
        ? path.resolve(inputDirArg)
        : path.join(process.cwd(), STATE_MACHINES_DIR)

    if (!fs.existsSync(inputDir)) {
        console.error(`Error: State machines directory not found: \`${inputDir}\``)
        console.error(`Usage: tsx smtt.ts ${commandName} [--input-dir INPUT_DIR] [--ast-file AST_FILE] [--output-dir OUTPUT_DIR]`)
        process.exit(1)
    }

    const astFileArg = flagValue(subArgs, "--ast-file")
    const outputDirArg = flagValue(subArgs, "--output-dir")
    const outputDir = outputDirArg ? path.resolve(outputDirArg) : process.cwd()

    // The AST file defaults to `<input-dir>/state-machines.json`. When the user
    // passes `--output-dir` (without `--ast-file`), the AST file is placed at
    // `<output-dir>/state-machines.json` so chained subcommands (`infer`,
    // `generate`) can share the same AST file via a single `--output-dir`.
    const astFile = astFileArg
        ? path.resolve(astFileArg)
        : outputDirArg
            ? path.join(outputDir, `${STATE_MACHINES_DIR}.json`)
            : path.join(inputDir, `${STATE_MACHINES_DIR}.json`)

    return { inputDir, astFile, outputDir }
}

// --- Subcommand handlers ---

function parseCli(subArgs: string[]): void {
    // TODO: Implement strict mode (exit with code 1 when warnings are produced).
    const { inputDir, astFile } = resolveCliPaths(subArgs, "parse")

    parse(inputDir, astFile)
}

function inferCli(subArgs: string[]): void {
    const { astFile } = resolveCliPaths(subArgs, "infer")

    parseCli(subArgs)
    infer(astFile)
}

function generateCli(subArgs: string[]): void {
    const { astFile, outputDir } = resolveCliPaths(subArgs, "generate")

    parseCli(subArgs)
    generate(astFile, outputDir)
}

function analyzeCli(subArgs: string[]): void {
    const astFileArg = flagValue(subArgs, "--ast-file")
    const infer = subArgs.includes("--infer")

    if (astFileArg && infer) {
        throw new Error("Options --infer and --ast-file are mutually exclusive.")
    }

    let inputDir: string
    let astFile: string | undefined

    if (astFileArg) {
        astFile = path.resolve(astFileArg)
        if (!fs.existsSync(astFile)) {
            console.error(`Error: AST JSON file not found: \`${astFile}\``)
            process.exit(1)
        }
        inputDir = path.dirname(astFile)
    } else {
        const paths = resolveCliPaths(subArgs, "analyze")
        inputDir = paths.inputDir
    }

    const outputFileArg = flagValue(subArgs, "--output-file")
    const outputFile = outputFileArg ? path.resolve(outputFileArg) : undefined
    const maxStatesArg = flagValue(subArgs, "--max-states")
    const maxStates = maxStatesArg ? Number.parseInt(maxStatesArg, 10) : 100000
    if (!Number.isFinite(maxStates) || maxStates <= 0) {
        throw new Error("Invalid value for --max-states; expected a positive integer.")
    }

    analyze(inputDir, {
        astFile,
        infer,
        outputFile,
        maxStates,
        externalOnly: subArgs.includes("--triggers=external-only"),
        strictMode: subArgs.includes("--strict"),
    })
}

function renumberCli(subArgs: string[]): void {
    const { inputDir } = resolveCliPaths(subArgs, "renumber")
    renumber(inputDir)
}

// --- Dispatch ---

function printUsage(): void {
    console.log("Usage: tsx smtt.ts <command> [options]")
    console.log("")
    console.log("Global options:")
    console.log("  --help               Show this help text.")
    console.log("")
    console.log("Commands:")
    console.log("  parse                Parse `*.state-machine.md` files recursively from")
    console.log("                       `--input-dir` and emit an AST JSON file.")
    console.log("  infer                Run `parse`, then infer impossible trigger - state combinations")
    console.log("                       and insert them in the same AST JSON file.")
    console.log("  analyze              Run analysis and write a markdown report.")
    console.log("  generate             Run `parse`, then generate feature files, step")
    console.log("                       definitions, and fixture stubs.")
    console.log("  renumber             Rewrite transition IDs in the source *.state-machine.md files.")
    console.log("")
    console.log("Run `tsx smtt.ts <command> --help` for command-specific options.")
}

function printParseHelp(): void {
    console.log("Usage: tsx smtt.ts parse [--input-dir INPUT_DIR] [--ast-file AST_FILE] [--strict]")
    console.log("")
    console.log("Parses all `*.state-machine.md` files recursively from `--input-dir`")
    console.log("and writes an AST JSON file.")
    console.log("")
    console.log("Options:")
    console.log("  --input-dir INPUT_DIR    Directory searched recursively for `*.state-machine.md` files.")
    console.log("                           Default: `$CWD/state-machines/`.")
    console.log("  --ast-file AST_FILE      Write AST JSON to this file instead of the default.")
    console.log("                           Default: `INPUT_DIR/state-machines.json`.")
    console.log("                           Relative paths are resolved from the current directory.")
    console.log("  --strict                 Exit with code 1 when any warnings were produced.")
    console.log("                           Warnings are always written to stderr regardless.")
}

function printInferHelp(): void {
    console.log("Usage: tsx smtt.ts infer [--input-dir INPUT_DIR] [--ast-file AST_FILE] [--strict]")
    console.log("")
    console.log("Runs `parse` first, then infers impossible trigger/state combinations")
    console.log("using the closed-world assumption and writes them into `impossible.inferred`")
    console.log("in the AST JSON file created by the `parse` step, alongside the existing ")
    console.log("`impossible.defined` entries.")
    console.log("Note this information is used by the analysis workflow, not by `generate`.")
    console.log("")
    console.log("Options:")
    console.log("  --input-dir INPUT_DIR    Directory searched recursively for `*.state-machine.md` files.")
    console.log("                           Default: `$CWD/state-machines/`.")
    console.log("  --ast-file AST_FILE      Path for the AST JSON file used as both parse output and infer input/output.")
    console.log("                           Default: `INPUT_DIR/state-machines.json`.")
    console.log("                           Relative paths are resolved from the current directory.")
    console.log("  --strict                 Exit with code 1 when any warnings were produced.")
    console.log("                           Warnings are always written to stderr regardless.")
}

function printAnalyzeHelp(): void {
    console.log("Usage: tsx smtt.ts analyze [--input-dir INPUT_DIR] [--ast-file AST_FILE] [--infer] [--output-file OUTPUT_FILE] [--max-states MAX_STATES] [--triggers=external-only] [--strict]")
    console.log("")
    console.log("Runs state-space analysis and writes a markdown report.")
    console.log("Impossibilities can be inferred dynamically with `--infer` or loaded from")
    console.log("an existing AST JSON file via `--ast-file`, to reduce false-positive unhandled triggers.")
    console.log("")
    console.log("Options:")
    console.log("  --input-dir INPUT_DIR        Directory searched recursively for `*.state-machine.md` files.")
    console.log("                               Default: `$CWD/state-machines/`.")
    console.log("  --ast-file AST_FILE          Read state machines from AST JSON instead of parsing markdown.")
    console.log("                               Mutually exclusive with `--infer`.")
    console.log("  --infer                      Infer impossible trigger/state combinations during analysis.")
    console.log("                               Mutually exclusive with `--ast-file`.")
    console.log("  --output-file OUTPUT_FILE    Output markdown report path.")
    console.log("                               Default: `INPUT_DIR/INPUT_DIR_NAME.analysis.md`.")
    console.log("  --max-states MAX_STATES      Maximum global states explored by state-space exploration.")
    console.log("                               Default: `100000`.")
    console.log("  --triggers=external-only     Analyze only externally-driven triggers.")
    console.log("  --strict                     Exit with code 1 when report shows issues.")
}

function printGenerateHelp(): void {
    console.log("Usage: tsx smtt.ts generate [--input-dir INPUT_DIR] [--ast-file AST_FILE] [--output-dir OUTPUT_DIR]")
    console.log("")
    console.log("Runs `parse` first, then generates:")
    console.log("  <output-dir>/features/    One `.feature` file per state machine (always overwritten).")
    console.log("  <output-dir>/steps/       One `.steps.js` file per state machine (always overwritten).")
    console.log("  <output-dir>/fixtures/    One `.fixtures.js` file per state machine (stubs appended only).")
    console.log("`generate` does not require or consume `impossible.inferred` from `infer`.")
    console.log("")
    console.log("Options:")
    console.log("  --input-dir INPUT_DIR    Directory searched recursively for `*.state-machine.md` files.")
    console.log("                           Default: `$CWD/state-machines/`.")
    console.log("  --ast-file AST_FILE      Intermediate AST JSON file written by `parse` and read by `generate`.")
    console.log("                           Default: `INPUT_DIR/state-machines.json`.")
    console.log("                       Relative paths are resolved from the current directory.")
    console.log("  --output-dir OUTPUT_DIR   Base directory for `features/`, `steps/`, and `fixtures/` output.")
    console.log("                       Default: current directory.")
}

function printRenumberHelp(): void {
    console.log("Usage: tsx smtt.ts renumber [--input-dir INPUT_DIR]")
    console.log("")
    console.log("Parses all `*.state-machine.md` files recursively from `--input-dir`")
    console.log("and rewrites transition IDs in source markdown tables using a deterministic")
    console.log("global order by source file path and line number.")
    console.log("")
    console.log("Options:")
    console.log("  --input-dir INPUT_DIR    Directory searched recursively for `*.state-machine.md` files.")
    console.log("                           Default: `$CWD/state-machines/`.")
}

const commandHandlers: Record<string, (subArgs: string[]) => void | Promise<void>> = {
    parse: parseCli,
    infer: inferCli,
    analyze: analyzeCli,
    generate: generateCli,
    renumber: renumberCli,
}

const commandHelp: Record<string, () => void> = {
    parse: printParseHelp,
    infer: printInferHelp,
    analyze: printAnalyzeHelp,
    generate: printGenerateHelp,
    renumber: printRenumberHelp,
}

if (args.includes("--help")) {
    const helpHandler = command && command in commandHelp ? commandHelp[command] : printUsage
    helpHandler()
    process.exit(0)
}

if (!command || !(command in commandHandlers)) {
    printUsage()
    process.exit(1)
}

try {
    await commandHandlers[command](args)
} catch (err) {
    console.error(err instanceof Error ? err.message : String(err))
    process.exit(1)
}
