import fs from "fs"
import path from "path"
import type { DefaultPrecondition, StateMachine, StateRef, Transition } from "../parse"
import {
    collectChainFilterConditions,
    collectImpliedFilterConditions,
    type FilterCondition,
} from "./conditions"
import {
    buildTaggedTransitions,
    collectContributingStateMachineNames,
    expandStateTrigger,
    hasUnresolvableStateTrigger,
    type ExpansionPath,
    type TaggedTransition,
} from "./expansion"
import {
    collectExampleColumns,
    filterRows,
    formatExamplesTable,
    mergeExampleValues,
    mergeOtherValues,
    type ExampleColumn,
} from "./examples"
import { buildEffectiveGivens } from "./givens"
import {
    ambiguousStateNames,
    buildImpliedConditionsIndex,
    buildStateOwnership,
    ownerOfStateRef,
    type ImpliedConditionsIndex,
    type StateOwnershipIndex,
} from "./ownership"
import {
    fixtureNameFromStep,
    getStepParams,
    lowerCaseLabelPreservingValueLiterals,
    resolveBaseParams,
    slugify,
    stateRefText,
    toOutlinePattern,
    triggerText,
} from "./text"

/** Maximum rendered length of a scenario label, including its indentation (REQ-159). */
const MAX_LABEL_LENGTH = 200

/** One generated step derived from normalized feature data. */
export interface Step {
    keyword: "Given" | "When" | "Then"
    pattern: string
    params: string[]
    fixtureName: string
    transitionIds: string[]
}

/** Generated steps belonging to one state machine. */
export interface Feature {
    stateMachine: StateMachine
    steps: Step[]
}

/** Everything needed to render the transitions of one state machine. */
interface RenderContext {
    stateMachine: StateMachine
    defaultPreconditions: DefaultPrecondition[]
    ownership: StateOwnershipIndex
    taggedTransitions: TaggedTransition[]
    stateMachines: StateMachine[]
    impliedIndex: ImpliedConditionsIndex
}

// --- Examples table ---

/**
 * Describe a transition by its id, for use in error messages.
 *
 * @param transition Transition to describe.
 * @returns The transition description.
 */
function transitionDescription(transition: Transition): string {
    return transition.id ? `transition "${transition.id}"` : "anonymous transition"
}

/**
 * Build the `Examples:` block of a transition (REQ-063).
 *
 * @param context Rendering context for the owning state machine.
 * @param transition Transition being rendered.
 * @param columns Examples columns for the transition.
 * @returns The rendered table, or `null` when the transition's state trigger is unresolvable.
 *   The dedicated REQ-164 error is then raised while rendering the scenario itself, instead of
 *   a possibly unrelated missing-example-values error here.
 * @throws Error When the contributing state machines define no example values (REQ-157/REQ-163), or
 *   when all rows are filtered out (REQ-100).
 */
function buildExamplesTable(context: RenderContext, transition: Transition, columns: ExampleColumn[]): string | null {
    const { stateMachine, defaultPreconditions, ownership, taggedTransitions, stateMachines, impliedIndex } = context
    if (hasUnresolvableStateTrigger(transition, taggedTransitions)) return null

    const contributingStateMachines = collectContributingStateMachineNames(
        stateMachine, transition, defaultPreconditions, ownership, taggedTransitions,
    )
    const exampleValues = mergeExampleValues(stateMachines, contributingStateMachines)
    const otherValues = mergeOtherValues(stateMachines, contributingStateMachines)
    if (exampleValues.length === 0) {
        throw new Error(
            `Invalid state machine "${stateMachine.name}": ${transitionDescription(transition)} ` +
                `references argument(s), but the state machine's dataExampleValues table is empty or ` +
                `absent (REQ-157/REQ-163).`,
        )
    }

    const availableAttributes = new Set(Object.keys(exampleValues[0]))
    const filters: FilterCondition[] = [
        ...collectChainFilterConditions(transition, taggedTransitions),
        ...collectImpliedFilterConditions(
            stateMachine, transition, defaultPreconditions, ownership, impliedIndex, availableAttributes,
        ),
    ]
    const rows = filterRows(exampleValues, filters, exampleValues, otherValues)
    if (rows.length === 0) {
        throw new Error(
            `Empty examples table for transition ${transition.id} in state machine \`${stateMachine.name}\``,
        )
    }
    return formatExamplesTable(columns, rows, exampleValues, otherValues)
}

// --- Scenario rendering ---

/**
 * The expansion paths of a transition: one per resolved source, or a single direct path (REQ-113).
 *
 * @param context Rendering context for the owning state machine.
 * @param transition Transition to resolve.
 * @returns The expansion paths for the transition.
 */
function resolveExpansionPaths(context: RenderContext, transition: Transition): ExpansionPath[] {
    if (transition.trigger.type === "state") {
        return expandStateTrigger(transition.trigger, context.ownership, context.taggedTransitions, transition)
    }
    return [{
        whenText: triggerText(transition.trigger),
        whenOwner: context.stateMachine.name,
        intermediateThenTexts: [],
        intermediateThenOwners: [],
        injectedGivenStates: [],
    }]
}

/**
 * Compose the scenario label (REQ-009 up to REQ-031). The label includes the transition id,
 * own state, result state, trigger and remaining context states. The part following the id is
 * lower cased (REQ-028) and the whole label is truncated to `MAX_LABEL_LENGTH` (REQ-159).
 *
 * @param transition Transition being rendered.
 * @param keyword Scenario keyword, either `Scenario` or `Scenario Outline`.
 * @param ownGiven The `Given` state belonging to the rendering state machine, if any.
 * @param contextGivens All other `Given` states, in effective step order.
 * @param idSuffix Expansion path suffix, e.g. `.2`, or `""` for a single path.
 * @returns The rendered scenario label.
 */
function buildScenarioLabel(
    transition: Transition,
    keyword: string,
    ownGiven: StateRef | undefined,
    contextGivens: StateRef[],
    idSuffix: string,
): string {
    const ownText = ownGiven ? stateRefText(ownGiven) : "?"
    const contextPart = contextGivens.length === 0
        ? ""
        : `; given ${contextGivens.map((stateRef) => stateRefText(stateRef)).join(", ")}`
    const labelTail = lowerCaseLabelPreservingValueLiterals(
        `${ownText} → ${stateRefText(transition.result, true)}` +
            `; when ${triggerText(transition.trigger)}${contextPart}`,
    )

    const label = `  ${keyword}: [${transition.id ?? ""}${idSuffix}] ${labelTail}`
    return label.length > MAX_LABEL_LENGTH ? `${label.slice(0, MAX_LABEL_LENGTH - 3)}...` : label
}

/**
 * Compose the `Given`/`When`/`Then` steps of a scenario (REQ-032 up to REQ-046/REQ-109).
 *
 * @param transition Transition being rendered.
 * @param path Expansion path to render.
 * @param effectiveGivens Effective `Given` states of the scenario.
 * @returns The rendered step lines.
 */
function buildScenarioSteps(transition: Transition, path: ExpansionPath, effectiveGivens: StateRef[]): string[] {
    const steps = effectiveGivens.map((stateRef, index) =>
        `    ${index === 0 ? "Given" : "And"} initially ${stateRefText(stateRef)}`,
    )
    steps.push(`    When ${path.whenText}`)

    // Intermediate results of an expansion chain precede the transition's own result (REQ-146).
    const thenTexts = [...path.intermediateThenTexts, stateRefText(transition.result, true)]
    steps.push(...thenTexts.map((text, index) => `    ${index === 0 ? "Then" : "And"} expect ${text}`))
    return steps
}

/**
 * Render all scenarios of a transition: one per expansion path (REQ-113).
 *
 * @param context Rendering context for the owning state machine.
 * @param transition Transition being rendered.
 * @param examplesTable Rendered `Examples:` block, or `null` for a plain scenario.
 * @param isOutline Whether the transition references arguments (REQ-047).
 * @returns One rendered scenario block per expansion path.
 */
function renderScenarios(
    context: RenderContext,
    transition: Transition,
    examplesTable: string | null,
    isOutline: boolean,
): string[] {
    const { stateMachine, defaultPreconditions, ownership } = context
    const expansionPaths = resolveExpansionPaths(context, transition)
    const keyword = isOutline ? "Scenario Outline" : "Scenario"

    return expansionPaths.map((path, pathIndex) => {
        const effectiveGivens = buildEffectiveGivens(
            transition, defaultPreconditions, ownership, stateMachine, path.injectedGivenStates,
        )
        const ownGiven = effectiveGivens.find(
            (stateRef) => ownerOfStateRef(stateRef, ownership) === stateMachine.name,
        )
        const contextGivens = effectiveGivens.filter((stateRef) => stateRef !== ownGiven)
        const idSuffix = expansionPaths.length > 1 ? `.${pathIndex + 1}` : ""

        const lines = [
            buildScenarioLabel(transition, keyword, ownGiven, contextGivens, idSuffix),
            ...buildScenarioSteps(transition, path, effectiveGivens),
        ]
        if (transition.notes) lines.push(`    # Notes: ${transition.notes}`)
        if (examplesTable) lines.push(examplesTable)
        return lines.join("\n")
    })
}

// --- Feature file rendering ---

/**
 * Register a generated step for a state machine.
 *
 * @param stateMachineData Per-state-machine step store.
 * @param stateMachineName Target state machine name.
 * @param keyword Step keyword.
 * @param pattern Rendered step pattern.
 * @param params Step callback parameter names.
 * @param fixtureName Fixture function name derived from the step.
 * @param transitionId Source transition id.
 */
function registerStep(
    stateMachineData: Map<string, Step[]>,
    stateMachineName: string,
    keyword: "Given" | "When" | "Then",
    pattern: string,
    params: string[],
    fixtureName: string,
    transitionId: string | undefined,
): void {
    const steps = stateMachineData.get(stateMachineName)
    if (steps === undefined) {
        stateMachineData.set(stateMachineName, [{
            keyword,
            pattern,
            params,
            fixtureName,
            transitionIds: [transitionId ?? "?"],
        }])
        return
    }

    const key = `${keyword}:${pattern}`
    const existing = steps.find((step) => `${step.keyword}:${step.pattern}` === key)
    if (existing === undefined) {
        steps.push({
            keyword,
            pattern,
            params,
            fixtureName,
            transitionIds: [transitionId ?? "?"],
        })
    } else {
        existing.transitionIds.push(transitionId ?? "?")
        if (params.length > existing.params.length) {
            existing.params = params
        }
    }
}

/**
 * Collect generated steps required by one transition.
 *
 * @param transition Transition to normalize.
 * @param stateMachine Owning state machine.
 * @param defaultPreconditions Default preconditions of the owning state machine.
 * @param ownership State ownership index.
 * @param taggedTransitions All transitions of all state machines.
 * @param stateMachineData Per-state-machine step store.
 */
function collectTransitionSteps(
    transition: Transition,
    stateMachine: StateMachine,
    defaultPreconditions: NonNullable<StateMachine["defaultPreconditions"]>,
    ownership: ReturnType<typeof buildStateOwnership>,
    taggedTransitions: ReturnType<typeof buildTaggedTransitions>,
    stateMachineData: Map<string, Step[]>,
): void {
    const exampleColumns = collectExampleColumns(transition, defaultPreconditions)
    const expansionPaths = transition.trigger.type === "state"
        ? expandStateTrigger(transition.trigger, ownership, taggedTransitions, transition)
        : [{
            whenText: triggerText(transition.trigger),
            whenOwner: stateMachine.name,
            intermediateThenTexts: [],
            intermediateThenOwners: [],
            injectedGivenStates: [],
        }]

    for (const expansionPath of expansionPaths) {
        const effectiveGivens = buildEffectiveGivens(
            transition,
            defaultPreconditions,
            ownership,
            stateMachine,
            expansionPath.injectedGivenStates,
        )
        for (const stateRef of effectiveGivens) {
            const owner = ownerOfStateRef(stateRef, ownership) ?? stateMachine.name
            registerStep(
                stateMachineData,
                owner,
                "Given",
                `initially ${toOutlinePattern(stateRefText(stateRef))}`,
                resolveBaseParams(getStepParams(stateRefText(stateRef)), exampleColumns),
                fixtureNameFromStep("Given", toOutlinePattern(`initially ${stateRefText(stateRef)}`)),
                transition.id,
            )
        }

        registerStep(
            stateMachineData,
            expansionPath.whenOwner || stateMachine.name,
            "When",
            toOutlinePattern(expansionPath.whenText),
            resolveBaseParams(getStepParams(expansionPath.whenText), exampleColumns),
            fixtureNameFromStep("When", toOutlinePattern(expansionPath.whenText)),
            transition.id,
        )

        for (let index = 0; index < expansionPath.intermediateThenTexts.length; index++) {
            const thenRawText = expansionPath.intermediateThenTexts[index]
            registerStep(
                stateMachineData,
                expansionPath.intermediateThenOwners[index] || stateMachine.name,
                "Then",
                `expect ${toOutlinePattern(thenRawText)}`,
                resolveBaseParams(getStepParams(thenRawText), exampleColumns),
                fixtureNameFromStep("Then", toOutlinePattern(`expect ${thenRawText}`)),
                transition.id,
            )
        }

        const resultText = stateRefText(transition.result, true)
        registerStep(
            stateMachineData,
            ownerOfStateRef(transition.result, ownership) ?? stateMachine.name,
            "Then",
            `expect ${toOutlinePattern(resultText)}`,
            resolveBaseParams(getStepParams(resultText), exampleColumns),
            fixtureNameFromStep("Then", toOutlinePattern(`expect ${resultText}`)),
            transition.id,
        )
    }
}


/**
 * Render the feature header: the state machine name and its optional overview (REQ-004/REQ-005).
 *
 * @param stateMachine State machine to render.
 * @returns The feature header.
 */
function renderFeatureHeader(stateMachine: StateMachine): string {
    const lines = [`Feature: ${stateMachine.name}`]
    if (stateMachine.overview != null) lines.push(`  ${stateMachine.overview}`)
    return lines.join("\n")
}

/**
 * Render the complete feature file of one state machine (REQ-001/REQ-127/REQ-128).
 *
 * @param context Rendering context for the owning state machine.
 * @returns The rendered feature file.
 */
function renderFeatureFile(context: RenderContext): string {
    const scenarioBlocks: string[] = []
    for (const transition of context.stateMachine.transitions ?? []) {
        const columns = collectExampleColumns(transition, context.defaultPreconditions)
        const isOutline = columns.length > 0
        const examplesTable = isOutline ? buildExamplesTable(context, transition, columns) : null
        scenarioBlocks.push(...renderScenarios(context, transition, examplesTable, isOutline))
    }

    const parts = [renderFeatureHeader(context.stateMachine), ""]
    if (scenarioBlocks.length > 0) parts.push(scenarioBlocks.join("\n\n"))
    return `${parts.join("\n")}\n`
}

// --- Public API ---

/**
 * Build normalized feature data for step and fixture generation.
 *
 * @param stateMachines State machines to normalize.
 * @returns Generated steps derived from the feature rendering model, grouped by state machine.
 */
export function buildFeatures(stateMachines: StateMachine[]): Feature[] {
    const ownership = buildStateOwnership(stateMachines)
    const taggedTransitions = buildTaggedTransitions(stateMachines)
    const stateMachineData = new Map<string, Step[]>()

    for (const stateMachine of stateMachines) {
        stateMachineData.set(stateMachine.name, [])
    }

    for (const stateMachine of stateMachines) {
        for (const transition of stateMachine.transitions ?? []) {
            collectTransitionSteps(
                transition,
                stateMachine,
                stateMachine.defaultPreconditions ?? [],
                ownership,
                taggedTransitions,
                stateMachineData,
            )
        }
    }

    return stateMachines.map((stateMachine) => ({
        stateMachine,
        steps: stateMachineData.get(stateMachine.name) ?? [],
    }))
}

/**
 * Render all state machines of the AST to Gherkin feature file contents.
 *
 * @param stateMachines State machines to render.
 * @returns The full file text per state machine, keyed by the slugified state machine name (REQ-131).
 * @throws Error When a state name is declared by multiple state machines (REQ-154), or when any
 *   transition is invalid.
 */
export function renderFeatures(stateMachines: StateMachine[]): Map<string, string> {
    const ownership = buildStateOwnership(stateMachines)
    const ambiguousNames = ambiguousStateNames(ownership)
    if (ambiguousNames.length > 0) {
        throw new Error(
            `Ambiguous state name lookup: duplicate state names across machines: ` +
                `${ambiguousNames.join(", ")} (REQ-154).`,
        )
    }

    const impliedIndex = buildImpliedConditionsIndex(stateMachines)
    const taggedTransitions = buildTaggedTransitions(stateMachines)
    const features = new Map<string, string>()
    for (const stateMachine of stateMachines) {
        const context: RenderContext = {
            stateMachine,
            defaultPreconditions: stateMachine.defaultPreconditions ?? [],
            ownership,
            taggedTransitions,
            stateMachines,
            impliedIndex,
        }
        features.set(slugify(stateMachine.name), renderFeatureFile(context))
    }
    return features
}

/**
 * Write one `.feature` file per state machine into `dir`, named after the slugified
 * state machine name (REQ-002/REQ-131). Existing files are overwritten.
 *
 * @param features Normalized feature data generated from the same state machines.
 * @param dir Output directory for the feature files.
 */
export function writeFeatureFiles(features: Feature[], dir: string): void {
    const renderedFeatures = renderFeatures(features.map((feature) => feature.stateMachine))
    for (const feature of features) {
        const name = slugify(feature.stateMachine.name)
        const content = renderedFeatures.get(name)
        if (content === undefined) continue
        const filePath = path.join(dir, `${name}.feature`)
        fs.writeFileSync(filePath, content, "utf8")
        console.info("Generated: `" + filePath + "`")
    }
}
