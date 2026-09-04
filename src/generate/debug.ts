import { writeFileSync } from "fs"
import { join as joinPath } from "path"
import type { StateMachine, Transition } from "../parse"
import {
    buildTaggedTransitions,
    findExpansionSources,
    MAX_EXPANSION_DEPTH,
    type TaggedTransition,
} from "./expansion"
import { stateRefText, triggerText } from "./text"

const DEBUG_FILE_NAME = "generate.debug.md"

interface ExpansionDebugNode {
    stateMachineName: string
    transition: Transition
    children: ExpansionDebugNode[]
}

/**
 * Render one transition row in a compact table-like inline format.
 *
 * @param stateMachineName Name of the transition owner.
 * @param transition Transition to render.
 * @returns Human-readable transition row text for the debug report.
 */
function transitionRowText(stateMachineName: string, transition: Transition): string {
    const statePart = (transition.states ?? []).length > 0
        ? (transition.states ?? []).map((stateRef) => stateRefText(stateMachineName, stateRef)).join(", ")
        : "-"
    const triggerPart = triggerText(stateMachineName, transition.trigger)
    const resultPart = stateRefText(stateMachineName, transition.result, true)
    const idPart = transition.id ? `[${transition.id}] ` : ""
    return `${idPart}${statePart} | ${triggerPart} -> ${resultPart}`
}

/**
 * Resolve one transition's recursive state-trigger expansion tree.
 *
 * @param transition Transition to expand.
 * @param taggedTransitions All transitions tagged with owner machine name.
 * @param expansionStack Expansion chain guard for cycle prevention.
 * @param depth Current recursive depth.
 * @returns Child expansion nodes, one per expansion source alternative.
 */
function buildExpansionTree(
    transition: Transition,
    taggedTransitions: TaggedTransition[],
    expansionStack: ReadonlySet<Transition> = new Set(),
    depth = 0,
): ExpansionDebugNode[] {
    if (transition.trigger.type !== "state" || depth > MAX_EXPANSION_DEPTH) return []
    if (expansionStack.has(transition)) return []

    const excluded = new Set([transition])
    const sources = findExpansionSources(transition.trigger, taggedTransitions, excluded)
    const nextStack = new Set(expansionStack)
    nextStack.add(transition)

    return sources.map((source) => ({
        stateMachineName: source.stateMachineName,
        transition: source.transition,
        children: buildExpansionTree(source.transition, taggedTransitions, nextStack, depth + 1),
    }))
}

/**
 * Render expansion nodes as nested markdown bullet lines.
 *
 * @param nodes Expansion nodes to render.
 * @param depth Bullet indentation depth.
 * @returns Rendered markdown lines for the expansion subtree.
 */
function renderExpansionNodes(nodes: ExpansionDebugNode[], depth: number): string[] {
    const indent = "    ".repeat(depth)
    const lines: string[] = []

    for (let index = 0; index < nodes.length; index++) {
        const node = nodes[index]
        const altLabel = ` (expansion alt ${index + 1})`
        lines.push(
            `${indent}- ${node.stateMachineName} ` +
            `${transitionRowText(node.stateMachineName, node.transition)}${altLabel}`,
        )
        lines.push(...renderExpansionNodes(node.children, depth + 1))
    }

    return lines
}

/**
 * Render the full debug report for `generate` transition processing.
 *
 * @param stateMachines Parsed state machines.
 * @returns Markdown debug report text.
 */
export function renderGenerateDebugReport(stateMachines: StateMachine[]): string {
    const taggedTransitions = buildTaggedTransitions(stateMachines)
    const lines: string[] = [
        "# SMTT Generate Debug",
        "",
        "Processed transitions and their state-trigger expansion trees.",
        "",
    ]

    for (const stateMachine of stateMachines) {
        for (const transition of stateMachine.transitions ?? []) {
            lines.push(`- ${stateMachine.name} ${transitionRowText(stateMachine.name, transition)}`)
            const children = buildExpansionTree(transition, taggedTransitions)
            lines.push(...renderExpansionNodes(children, 1))
        }
    }

    lines.push("")
    return lines.join("\n")
}

/**
 * Write the `generate` debug report to disk.
 *
 * @param stateMachines Parsed state machines.
 * @param outputDir Generate output directory.
 * @returns Absolute path to the written debug report.
 */
export function writeGenerateDebugFile(
    stateMachines: StateMachine[],
    outputDir: string,
): string {
    const filePath = joinPath(outputDir, DEBUG_FILE_NAME)
    writeFileSync(filePath, renderGenerateDebugReport(stateMachines), "utf8")
    console.info("Generated: `" + filePath + "`")
    return filePath
}




