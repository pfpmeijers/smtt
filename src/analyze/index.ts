/**
 * Public interface for the state machine analyzer module.
 */

export { analyze, analyzeStateMachines, buildMarkdownReport } from "./analyze"
export type {
    AnalysisReport,
    AnalysisSummary,
    AnalyzeOptions,
    AnalyzeResult,
} from "./types"