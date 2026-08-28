/**
 * Type definitions for state machine static analysis, dependency tracing,
 * BFS state-space exploration, and reporting.
 */

import type { StateMachine, StateRef } from "../parse"

export interface StateIndexEntry {
    stateMachine: StateMachine
    state: string
}

export interface Precondition {
    state: string
    stateMachine: string | null
    unresolvable: boolean
}

export type ClassifiedTrigger =
    | {
          kind: "state-trigger"
          stateMachine: string
          state: string
          arguments: unknown
      }
    | {
          kind: "action"
          text: string
      }

export interface NormalizedTransition {
    id: string
    stateMachineName: string
    fromState: string | null
    toState: string | null
    preconditions: Precondition[]
    trigger: ClassifiedTrigger
    notes?: string
    source?: string
    sourceFile?: string
    lineNumber?: number
    ownStateNames?: Set<string>
    states?: StateRef[]
}

export interface DependencyTreeNode {
    transitionId: string
    cycle: boolean
    error?: string
    stateMachine?: string
    fromState?: string | null
    toState?: string | null
    triggerNode?: DependencyTreeTriggerNode | null
    preconditionNodes?: DependencyTreePreconditionNode[]
}

export interface DependencyTreeTriggerNode {
    kind: "state-trigger" | "action"
    text?: string
    stateMachine?: string
    state?: string
    satisfiedBy?: DependencyTreeNode[]
}

export interface DependencyTreePreconditionNode {
    state: string
    stateMachine: string | null
    satisfiedBy: DependencyTreeNode[]
}

export interface FailingPrecondition {
    stateMachine: string | null
    required: string
    actual: string | null
}

export interface UnhandledTriggerEntry {
    transitionId: string
    stateMachine: string
    fromState: string | null
    trigger: ClassifiedTrigger
    globalState: Record<string, string>
    failingPreconditions: FailingPrecondition[]
    source?: string
}

export interface ExplorationResult {
    reachableTransitions: Set<string>
    reachableGlobalStates: string[][]
    unhandledTriggers: UnhandledTriggerEntry[]
    truncated: boolean
}

export interface ExistingPrecondition {
    state: string
    isDefault: boolean
}

export interface MissingPreconditionRecord {
    transitionId: string
    stateMachine: string
    fromState: string | null
    trigger: string
    existingPreconditions: ExistingPrecondition[]
    missingState: string
    missingStateMachine: string
    predecessorIds: string[]
    alternatives: string[]
    suggestion: string | null
    sourceFile?: string
    lineNumber?: number
}

export interface UndeclaredConstraint {
    state: string
    stateMachine: string
}

export interface UncoveredPath {
    sourceTransitionId: string
    sourceTrigger: ClassifiedTrigger
    undeclaredConstraints: UndeclaredConstraint[]
}

export interface StateTriggerIssueRecord {
    transitionId: string
    stateMachine: string
    triggeredState: string
    triggerStateMachine: string
    paths?: UncoveredPath[]
    ambiguousPaths?: UncoveredPath[]
    sourceFile?: string
    lineNumber?: number
}

export interface StateTriggerIssues {
    ambiguousStateTriggers: StateTriggerIssueRecord[]
    invalidStateTriggers: StateTriggerIssueRecord[]
}

export interface CycleRecord {
    transitionId: string
}

export interface MissingVariantGroup {
    stateMachine: string
    trigger: ClassifiedTrigger
    transitionIds: string[]
    variants: FailingPrecondition[][]
}

export interface AnalysisInsights {
    totalTransitions: number
    reachableCount: number
    deadTransitions: NormalizedTransition[]
    unreachableStates: Record<string, string[]>
    unhandledTriggers: UnhandledTriggerEntry[]
    irrelevantTriggers: UnhandledTriggerEntry[]
    missingVariants: MissingVariantGroup[]
    cycles: CycleRecord[]
    missingPreconditions: MissingPreconditionRecord[]
    ambiguousStateTriggers: StateTriggerIssueRecord[]
    invalidStateTriggers: StateTriggerIssueRecord[]
    truncated: boolean
}

export interface DeadTransitionSummary {
    id: string
    stateMachine: string
    fromState: string | null
    toState: string | null
    trigger: ClassifiedTrigger
    sourceFile?: string
    lineNumber?: number
}

export type ImpossibilityMode = "inferred-new" | "inferred-ast" | "defined-only"

export interface AnalysisSummary {
    totalTransitions: number
    reachable: number
    dead: number
    unreachableStates: number
    eventTriggers: number
    unhandledTriggers: number
    irrelevantTriggers: number
    missingVariants: number
    cycles: number
    missingPreconditions: number
    ambiguousStateTriggers: number
    invalidStateTriggers: number
    definedImpossibilities: number
    inferredImpossibilities: number
    impossibilityMode: ImpossibilityMode
    truncated: boolean
}

export interface AnalysisReport {
    summary: AnalysisSummary
    deadTransitions: DeadTransitionSummary[]
    unreachableStates: Record<string, string[]>
    unhandledTriggers: UnhandledTriggerEntry[]
    irrelevantTriggers: UnhandledTriggerEntry[]
    missingVariants: MissingVariantGroup[]
    cycles: CycleRecord[]
    missingPreconditions: MissingPreconditionRecord[]
    ambiguousStateTriggers: StateTriggerIssueRecord[]
    invalidStateTriggers: StateTriggerIssueRecord[]
    dependencyTrees: Record<string, DependencyTreeNode>
    transitionSourceIndex: Record<string, string>
    astFile?: string
    impossibilityMode?: ImpossibilityMode
}

export interface AnalyzeOptions {
    astFile?: string
    infer?: boolean
    outputFile?: string
    maxStates?: number
    externalOnly?: boolean
    strictMode?: boolean
    impossibilityMode?: ImpossibilityMode
}

export interface AnalyzeResult {
    parseJsonPath: string
    mdOutputPath: string
    report: AnalysisReport
}

