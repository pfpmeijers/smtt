/**
 * Report construction and Markdown formatting for state machine analysis.
 */

import type { StateMachine } from "../parse"
import type {
    AnalysisInsights,
    AnalysisReport,
    ClassifiedTrigger,
    DependencyTreeNode,
    FailingPrecondition,
    ImpossibilityMode,
    UnhandledTriggerEntry,
} from "./types"

// --- Formatting helpers ---

/**
 * Builds a map from transition ID to source file and line location.
 *
 * @param stateMachines Array of state machines.
 * @returns Record mapping transition ID to source description string.
 */
export function buildTransitionSourceIndex(
    stateMachines: StateMachine[]
): Record<string, string> {
    const index: Record<string, string> = {}
    for (const stateMachine of stateMachines) {
        for (const transition of stateMachine.transitions ?? []) {
            if (transition.id && stateMachine.source) {
                index[transition.id] = `${stateMachine.source}#${transition.sourceLine ?? 1}`
            }
        }
    }
    return index
}

/**
 * Formats a trigger descriptor as a short string for Markdown tables.
 *
 * @param trigger Classified trigger descriptor or `null`.
 * @returns Short formatted string.
 */
export function formatTrigger(trigger: ClassifiedTrigger | null): string {
    if (!trigger) {
        return "—"
    }
    return trigger.kind === "state-trigger" ? `\`${trigger.state}\`` : trigger.text
}

/**
 * Formats a transition ID as a clickable markdown link to its source file line.
 *
 * @param transitionId Transition identifier.
 * @param transitionSourceIndex Map from transition ID to source file location.
 * @returns Markdown link or backticked ID.
 */
export function formatTransitionLink(
    transitionId: string,
    transitionSourceIndex: Record<string, string>
): string {
    if (!transitionId) {
        return "—"
    }
    const source = transitionSourceIndex[transitionId]
    if (!source) {
        return `\`${transitionId}\``
    }

    const [sourceFile, lineNumber] = source.split("#")
    if (!sourceFile || !lineNumber) {
        return `\`${transitionId}\``
    }

    const uri = `./${sourceFile.replace(/\\/g, "/")}#L${lineNumber}`
    return `[\`${transitionId}\`](${uri})`
}

/**
 * Collects all externally driven action event triggers across the analysis report.
 *
 * @param unhandledTriggers Array of unhandled trigger entries.
 * @param deadTransitions Array of dead transitions.
 * @param dependencyTrees Map of dependency tree nodes.
 * @returns Map of trigger text to set of state machine names using it.
 */
export function collectEventTriggers(
    unhandledTriggers: UnhandledTriggerEntry[],
    deadTransitions: Array<{ trigger: ClassifiedTrigger; stateMachine?: string }>,
    dependencyTrees: Record<string, DependencyTreeNode>
): Map<string, Set<string>> {
    const eventTriggers = new Map<string, Set<string>>()

    const addTrigger = (
        trigger: ClassifiedTrigger | null | undefined,
        stateMachineName: string | undefined
    ) => {
        if (!trigger || trigger.kind !== "action" || !stateMachineName) {
            return
        }
        if (!eventTriggers.has(trigger.text)) {
            eventTriggers.set(trigger.text, new Set())
        }
        eventTriggers.get(trigger.text)?.add(stateMachineName)
    }

    for (const entry of unhandledTriggers) {
        addTrigger(entry.trigger, entry.stateMachine)
    }
    for (const transition of deadTransitions) {
        addTrigger(transition.trigger, transition.stateMachine)
    }
    for (const tree of Object.values(dependencyTrees)) {
        if (tree.triggerNode?.kind === "action") {
            addTrigger(
                { kind: "action", text: tree.triggerNode.text ?? "" },
                tree.stateMachine
            )
        }
    }

    return eventTriggers
}

// --- Structured report builder ---

/**
 * Builds the full structured analysis report object.
 *
 * @param insights Derived analysis insights.
 * @param dependencyTrees Dependency trees map.
 * @param stateMachines Array of parsed state machines.
 * @returns Structured `AnalysisReport` object.
 */
export function buildReport(
    insights: AnalysisInsights,
    dependencyTrees: Record<string, DependencyTreeNode>,
    stateMachines: StateMachine[],
    options: {
        impossibilityMode?: ImpossibilityMode
        astFile?: string
    } = {}
): AnalysisReport {
    const groupedUnhandledCount = new Set(
        insights.unhandledTriggers.map(
            entry =>
                `${entry.stateMachine}||${entry.trigger.kind === "state-trigger" ? entry.trigger.state : entry.trigger.text}||${JSON.stringify(entry.failingPreconditions)}`
        )
    ).size

    const groupedIrrelevantCount = new Set(
        insights.irrelevantTriggers.map(
            entry =>
                `${entry.stateMachine}||${entry.trigger.kind === "state-trigger" ? entry.trigger.state : entry.trigger.text}||${JSON.stringify(entry.failingPreconditions)}`
        )
    ).size

    const eventTriggerCount = collectEventTriggers(
        insights.unhandledTriggers,
        insights.deadTransitions,
        dependencyTrees
    ).size

    let definedImpossibilities = 0
    let inferredImpossibilities = 0
    for (const machine of stateMachines) {
        definedImpossibilities += machine.impossible?.defined?.length ?? 0
        inferredImpossibilities += machine.impossible?.inferred?.length ?? 0
    }

    const impossibilityMode: ImpossibilityMode = options.impossibilityMode ?? "defined-only"

    return {
        summary: {
            totalTransitions: insights.totalTransitions,
            reachable: insights.reachableCount,
            dead: insights.deadTransitions.length,
            unreachableStates: Object.values(insights.unreachableStates).flat().length,
            eventTriggers: eventTriggerCount,
            unhandledTriggers: groupedUnhandledCount,
            irrelevantTriggers: groupedIrrelevantCount,
            missingVariants: insights.missingVariants.length,
            cycles: insights.cycles.length,
            missingPreconditions: insights.missingPreconditions.length,
            ambiguousStateTriggers: insights.ambiguousStateTriggers.length,
            invalidStateTriggers: insights.invalidStateTriggers.length,
            definedImpossibilities,
            inferredImpossibilities,
            impossibilityMode,
            truncated: insights.truncated,
        },
        deadTransitions: insights.deadTransitions.map(transition => ({
            id: transition.id,
            stateMachine: transition.stateMachineName,
            fromState: transition.fromState,
            toState: transition.toState,
            trigger: transition.trigger,
            sourceFile: transition.sourceFile,
            lineNumber: transition.lineNumber,
        })),
        unreachableStates: insights.unreachableStates,
        unhandledTriggers: insights.unhandledTriggers,
        irrelevantTriggers: insights.irrelevantTriggers,
        missingVariants: insights.missingVariants,
        cycles: insights.cycles,
        missingPreconditions: insights.missingPreconditions,
        ambiguousStateTriggers: insights.ambiguousStateTriggers,
        invalidStateTriggers: insights.invalidStateTriggers,
        dependencyTrees,
        transitionSourceIndex: buildTransitionSourceIndex(stateMachines),
        astFile: options.astFile,
        impossibilityMode,
    }
}

// --- Modular Markdown report section builders ---

/**
 * Builds the Markdown summary section.
 *
 * @param report Analysis report object.
 * @returns Array of markdown lines.
 */
function buildSummarySection(report: AnalysisReport): string[] {
    const lines: string[] = []
    const { summary } = report

    lines.push("## Summary\n")
    lines.push("| Metric | Count |")
    lines.push("|---|---|")
    lines.push(`| Total transitions | ${summary.totalTransitions} |`)
    lines.push(`| Reachable transitions | ${summary.reachable} |`)
    lines.push(`| Dead transitions | ${summary.dead} |`)
    lines.push(`| Unreachable states | ${summary.unreachableStates} |`)
    lines.push(`| Event triggers | ${summary.eventTriggers} |`)
    lines.push(`| Unhandled cases | ${summary.unhandledTriggers} |`)
    lines.push(`| Trigger groups | ${summary.missingVariants} |`)
    lines.push(`| Cycles / deadlocks | ${summary.cycles} |`)
    lines.push(`| Missing predecessor states | ${summary.missingPreconditions} |`)
    lines.push(`| Ambiguous state-triggers | ${summary.ambiguousStateTriggers} |`)
    lines.push(`| Invalid state-triggers | ${summary.invalidStateTriggers} |`)
    lines.push(`| Defined impossibilities | ${summary.definedImpossibilities} |`)
    lines.push(`| Inferred impossibilities | ${summary.inferredImpossibilities} |`)
    lines.push("")

    if (summary.impossibilityMode === "inferred-new") {
        lines.push(
            "> ℹ️ **Impossibility Inference:** Inferred impossibility combinations were computed on-the-fly (`--infer`) and applied to suppress unhandled trigger false positives.\n"
        )
    } else if (summary.impossibilityMode === "inferred-ast") {
        const astSource = report.astFile ? ` (\`${report.astFile}\`)` : ""
        lines.push(
            `> ℹ️ **Impossibility Inference:** Impossibilities were loaded from the input AST JSON file${astSource} (${summary.definedImpossibilities} defined, ${summary.inferredImpossibilities} inferred).\n`
        )
    } else {
        lines.push(
            "> ⚠️ **Impossibility Inference:** Inferred impossibilities were **not** computed or loaded. Unhandled cases may include combinations that are impossible under the closed-world assumption (run with `--infer` or pass `--ast-file` to apply).\n"
        )
    }

    if (summary.truncated) {
        lines.push(
            "> ⚠️ **WARN: state-space exploration truncated** — BFS hit the maximum state cap. Results may be incomplete.\n"
        )
    }
    return lines
}

/**
 * Builds the Markdown dead transitions section.
 *
 * @param report Analysis report object.
 * @returns Array of markdown lines.
 */
function buildDeadTransitionsSection(report: AnalysisReport): string[] {
    const lines: string[] = []
    lines.push("## Dead Transitions\n")
    if (!report.deadTransitions.length) {
        lines.push("_None — all transitions are reachable._\n")
    } else {
        lines.push("| ID | From | Trigger | To |")
        lines.push("|---|---|---|---|")
        for (const transition of report.deadTransitions) {
            const idLink = formatTransitionLink(transition.id, report.transitionSourceIndex)
            lines.push(
                `| ${idLink} | ${transition.fromState} | ${formatTrigger(transition.trigger)} | ${transition.toState} |`
            )
        }
        lines.push("")
    }
    return lines
}

/**
 * Builds the Markdown unreachable states section.
 *
 * @param report Analysis report object.
 * @returns Array of markdown lines.
 */
function buildUnreachableStatesSection(report: AnalysisReport): string[] {
    const lines: string[] = []
    lines.push("## Unreachable States\n")
    const unreachableStateMachineNames = Object.keys(report.unreachableStates)
    if (!unreachableStateMachineNames.length) {
        lines.push("_None — all states are reachable._\n")
    } else {
        for (const stateMachineName of unreachableStateMachineNames) {
            lines.push(`**${stateMachineName}**\n`)
            for (const state of report.unreachableStates[stateMachineName]) {
                lines.push(`- \`${state}\``)
            }
            lines.push("")
        }
    }
    return lines
}

/**
 * Builds the Markdown event triggers section.
 *
 * @param report Analysis report object.
 * @returns Array of markdown lines.
 */
function buildEventTriggersSection(report: AnalysisReport): string[] {
    const lines: string[] = []
    lines.push("## Event Triggers\n")
    lines.push(
        "These triggers do **not** refer to another state machine becoming a state. They represent externally driven events such as user actions, browser events, or administrative actions.\n"
    )
    const eventTriggers = collectEventTriggers(
        report.unhandledTriggers,
        report.deadTransitions,
        report.dependencyTrees
    )
    if (!eventTriggers.size) {
        lines.push("_None — all triggers are inter-state-machine state-change triggers._\n")
    } else {
        const stateMachineNames = new Set(
            [...eventTriggers.values()].flatMap(stateMachineSet => [...stateMachineSet])
        )
        lines.push("| Metric | Count |")
        lines.push("|---|---|")
        lines.push(`| Unique event triggers | ${eventTriggers.size} |`)
        lines.push(`| State machines with event triggers | ${stateMachineNames.size} |`)
        lines.push("")

        lines.push("| Trigger | State machine(s) |")
        lines.push("|---|---|")
        const sortedTriggers = [...eventTriggers.entries()].sort(([left], [right]) =>
            left.localeCompare(right)
        )
        for (const [text, stateMachines] of sortedTriggers) {
            lines.push(`| ${text} | ${[...stateMachines].join(", ")} |`)
        }
        lines.push("")
    }
    return lines
}

/**
 * Helper to format failing preconditions into a readable multiline cell.
 *
 * @param failingPreconditions Array of failing preconditions.
 * @returns Formatted string for table cell.
 */
function formatUnhandledWhenStates(failingPreconditions: FailingPrecondition[]): string {
    if (!failingPreconditions?.length) {
        return "—"
    }
    return failingPreconditions
        .map(precondition => `\`${precondition.actual ?? "unknown"}\``)
        .join("<br>")
}

/**
 * Builds the Markdown unhandled cases section.
 *
 * @param report Analysis report object.
 * @returns Array of markdown lines.
 */
function buildUnhandledCasesSection(report: AnalysisReport): string[] {
    const lines: string[] = []
    lines.push("## Unhandled Cases\n")
    if (!report.unhandledTriggers.length) {
        lines.push(
            "_None — all triggered transitions have matching preconditions in all reachable states._\n"
        )
        return lines
    }

    lines.push(
        "- **Related**: all transitions listening to the same trigger that hit the same unmet-state combination.\n"
    )

    const seen = new Set<string>()
    const unique = report.unhandledTriggers.filter(entry => {
        const key = `${entry.transitionId}||${JSON.stringify(entry.failingPreconditions)}`
        if (seen.has(key)) {
            return false
        }
        seen.add(key)
        return true
    })

    const groupedRows = new Map<
        string,
        {
            trigger: ClassifiedTrigger
            failingPreconditions: FailingPrecondition[]
            related: string[]
        }
    >()
    for (const entry of unique) {
        const triggerKey =
            entry.trigger.kind === "state-trigger" ? entry.trigger.state : entry.trigger.text
        const key = `${entry.stateMachine}||${triggerKey}||${JSON.stringify(entry.failingPreconditions)}`
        if (!groupedRows.has(key)) {
            groupedRows.set(key, {
                trigger: entry.trigger,
                failingPreconditions: entry.failingPreconditions,
                related: [],
            })
        }
        groupedRows.get(key)?.related.push(entry.transitionId)
    }

    const sortedRows = [...groupedRows.values()]
        .map(row => {
            const links = row.related
                .sort((left, right) =>
                    left.localeCompare(right, undefined, { numeric: true })
                )
                .map(id => formatTransitionLink(id, report.transitionSourceIndex))
                .join(", ")
            return {
                ...row,
                relatedLinks: links,
                relatedSortKey: row.related[0] || "",
            }
        })
        .sort((firstRow, secondRow) => {
            const relatedCompare = firstRow.relatedSortKey.localeCompare(
                secondRow.relatedSortKey,
                undefined,
                { numeric: true }
            )
            if (relatedCompare !== 0) {
                return relatedCompare
            }
            const triggerCompare = formatTrigger(firstRow.trigger).localeCompare(
                formatTrigger(secondRow.trigger)
            )
            if (triggerCompare !== 0) {
                return triggerCompare
            }
            return formatUnhandledWhenStates(firstRow.failingPreconditions).localeCompare(
                formatUnhandledWhenStates(secondRow.failingPreconditions)
            )
        })

    lines.push("| Trigger | Unhandled when | Related |")
    lines.push("|---|---|---|")
    for (const row of sortedRows) {
        lines.push(
            `| ${formatTrigger(row.trigger)} | ${formatUnhandledWhenStates(row.failingPreconditions)} | ${row.relatedLinks || "—"} |`
        )
    }
    lines.push("")
    return lines
}

/**
 * Builds the Markdown missing predecessor states section.
 *
 * @param report Analysis report object.
 * @returns Array of markdown lines.
 */
function buildMissingPredecessorSection(report: AnalysisReport): string[] {
    const lines: string[] = []
    lines.push("## Missing Predecessor States\n")
    if (!report.missingPreconditions.length) {
        lines.push(
            "_None — all event-trigger transitions declare their predecessor states._\n"
        )
        return lines
    }

    lines.push(
        "For each event-trigger transition whose transition state is not the state machine's initial"
    )
    lines.push(
        "state, the table below lists cross-state-machine states required by every **direct**"
    )
    lines.push(
        "predecessor transition into that transition state that are **absent** from the"
    )
    lines.push(
        "transition's own `State` cell — inherited context that was needed to get here"
    )
    lines.push("but not declared here.\n")
    lines.push(
        "- **Predecessor**: the direct predecessor transition that introduced this requirement."
    )
    lines.push(
        "- **Bypass**: another predecessor reaching the same transition state without this requirement."
    )
    lines.push(
        "  When a bypass exists the gap is conditional — only add the state if the intended path is via the predecessor.\n"
    )
    lines.push(
        "| Transition | State | Trigger | Missing predecessor state | Predecessor | Bypass |"
    )
    lines.push("|---|---|---|---|---|---|")
    for (const gap of report.missingPreconditions) {
        const stateParts = [
            ...gap.existingPreconditions.map(precondition =>
                precondition.isDefault ? `*(default)* ${precondition.state}` : precondition.state
            ),
            gap.fromState,
        ]
        const stateCell = stateParts.join(", and ")
        const idLink = formatTransitionLink(gap.transitionId, report.transitionSourceIndex)
        const predecessors = gap.predecessorIds
            .map(id => formatTransitionLink(id, report.transitionSourceIndex))
            .join(", ")
        const bypasses =
            gap.alternatives
                .filter(id => !gap.predecessorIds.includes(id))
                .map(id => formatTransitionLink(id, report.transitionSourceIndex))
                .join(", ") || "—"
        lines.push(
            `| ${idLink} | ${stateCell} | ${gap.trigger} | ${gap.missingState} | ${predecessors} | ${bypasses} |`
        )
    }
    lines.push("")
    return lines
}

/**
 * Builds the Markdown ambiguous state-triggers section.
 *
 * @param report Analysis report object.
 * @returns Array of markdown lines.
 */
function buildAmbiguousTriggersSection(report: AnalysisReport): string[] {
    const lines: string[] = []
    lines.push("## Ambiguous State-Triggers\n")
    if (!report.ambiguousStateTriggers.length) {
        lines.push(
            "_None — all state-trigger inner transitions are fully specified or absent._\n"
        )
        return lines
    }

    lines.push(
        "A state-trigger may result from different inner transitions of the"
    )
    lines.push(
        "trigger state machine. Inner transitions listed below have preconditions from"
    )
    lines.push(
        "state machines that are **not declared** in the outer transition's `State` cell,"
    )
    lines.push(
        "leaving those inner transitions' applicability in the middle — neither"
    )
    lines.push(
        "confirmed applicable nor ruled out. For the state-trigger, at least one"
    )
    lines.push(
        "inner transition is fully covered, so the trigger itself is valid.\n"
    )
    lines.push("- **Inner transition**: inner transition with uncovered preconditions.")
    lines.push(
        "- **Undeclared state**: state value as precondition for the inner transition"
    )
    lines.push("  that is missing from the outer `State` cell.\n")
    lines.push(
        "| Transition | State trigger | Inner transition | Undeclared state |"
    )
    lines.push("|---|---|---|---|")
    for (const warning of report.ambiguousStateTriggers) {
        for (const path of warning.ambiguousPaths ?? []) {
            const trigger =
                path.sourceTrigger.kind === "state-trigger"
                    ? `\`${path.sourceTrigger.state}\` (state-trigger)`
                    : (path.sourceTrigger.text ?? "—")
            for (const constraint of path.undeclaredConstraints) {
                const idLink = formatTransitionLink(
                    warning.transitionId,
                    report.transitionSourceIndex
                )
                const innerLink = formatTransitionLink(
                    path.sourceTransitionId,
                    report.transitionSourceIndex
                )
                lines.push(
                    `| ${idLink} | \`${warning.triggeredState}\` | ${innerLink} via ${trigger} | \`${constraint.state}\` |`
                )
            }
        }
    }
    lines.push("")
    return lines
}

/**
 * Builds the Markdown invalid state-triggers section.
 *
 * @param report Analysis report object.
 * @returns Array of markdown lines.
 */
function buildInvalidTriggersSection(report: AnalysisReport): string[] {
    const lines: string[] = []
    lines.push("## Invalid State-Triggers\n")
    if (!report.invalidStateTriggers.length) {
        lines.push(
            "_None — all state-triggers have at least one covered inner transition._\n"
        )
        return lines
    }

    lines.push(
        "A state-trigger is **invalid** when **none** of the inner transitions"
    )
    lines.push(
        "in the trigger state machine have their preconditions covered by the outer"
    )
    lines.push(
        "transition's `State` cell. The trigger can therefore never fire under"
    )
    lines.push(
        "the declared conditions, making the transition spec contradictory.\n"
    )
    lines.push("- **Inner transition**: inner transition with uncovered preconditions.")
    lines.push("- **Undeclared state**: state missing from the outer `State` cell.\n")
    lines.push(
        "| Transition | State trigger | Inner transition | Undeclared state |"
    )
    lines.push("|---|---|---|---|")
    for (const issue of report.invalidStateTriggers) {
        for (const path of issue.paths ?? []) {
            const trigger =
                path.sourceTrigger.kind === "state-trigger"
                    ? `\`${path.sourceTrigger.state}\` (state-trigger)`
                    : (path.sourceTrigger.text ?? "—")
            for (const constraint of path.undeclaredConstraints) {
                const idLink = formatTransitionLink(
                    issue.transitionId,
                    report.transitionSourceIndex
                )
                const innerLink = formatTransitionLink(
                    path.sourceTransitionId,
                    report.transitionSourceIndex
                )
                lines.push(
                    `| ${idLink} | \`${issue.triggeredState}\` | ${innerLink} via ${trigger} | \`${constraint.state}\` |`
                )
            }
        }
    }
    lines.push("")
    return lines
}

/**
 * Builds the Markdown cycles section.
 *
 * @param report Analysis report object.
 * @returns Array of markdown lines.
 */
function buildCyclesSection(report: AnalysisReport): string[] {
    const lines: string[] = []
    lines.push("## Cycles / Deadlocks\n")
    if (!report.cycles.length) {
        lines.push("_None — no circular dependencies detected._\n")
    } else {
        lines.push("The following transitions form circular dependency chains:\n")
        for (const cycle of report.cycles) {
            const idLink = formatTransitionLink(cycle.transitionId, report.transitionSourceIndex)
            lines.push(`- ${idLink}`)
        }
        lines.push("")
    }
    return lines
}

/**
 * Builds the complete human-readable Markdown analysis report.
 *
 * @param report Analysis report object.
 * @param _stateMachinesDir Optional state machines directory for link resolution.
 * @returns Formatted Markdown document string.
 */
export function buildMarkdownReport(
    report: AnalysisReport,
    _stateMachinesDir: string = ""
): string {
    const lines: string[] = []

    lines.push("# State Machines Analysis Report\n")
    lines.push(...buildSummarySection(report))
    lines.push(...buildDeadTransitionsSection(report))
    lines.push(...buildUnreachableStatesSection(report))
    lines.push(...buildEventTriggersSection(report))
    lines.push(...buildUnhandledCasesSection(report))
    lines.push(...buildMissingPredecessorSection(report))
    lines.push(...buildAmbiguousTriggersSection(report))
    lines.push(...buildInvalidTriggersSection(report))
    lines.push(...buildCyclesSection(report))

    return lines.join("\n")
}
