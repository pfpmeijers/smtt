import { readFileSync, writeFileSync } from "fs";
import * as ohm from "ohm-js"
import {
    Argument,
    Condition,
    ImpossibleTrigger,
    IrrelevantTrigger,
    Result,
    StateDefinition,
    StateMachine,
    StateRef,
    Transition,
    Trigger
} from "./sm.ast.d"

// --- Input sections not converted into output ---

type ImpliedEntry = ImpliedCondition | string

type StatesSection = {
    states: {
        name: string;
        description: string | null;
        impliedConditions?: ImpliedCondition[]
        impliedStates?: string[]
    }[]
    initialState?: string
}

type DataAttribute = {
    name: string;
    description: string | null
}

type DataSection = {
    data: Record<string, string>
    dataValueCombinations: Record<string, string>[]
    dataValues?: Record<string, string[]>
}

type DataTable = {
    columns: string[]
    rows: string[][]
}

/** One `### Values` entry: the values a single attribute may take. */
type AttributeValues = {
    name: string
    values: string[]
}

/** Reported when a `## Data` section declares both spellings of its value rows. */
const VALUES_WITH_VALUE_COMBINATIONS_TABLE =
    "`### Values` and a `### Value combinations` table are alternatives, not a pair: " +
    "drop the table to take every combination of the listed values, or drop `### Values` " +
    "to pair values into rows by hand."

/**
 * Turns a `### Value combinations` table into example-value rows, one record per row keyed by
 * column name. A row shorter than the header leaves the remaining columns undefined (`""`).
 *
 * @param table Parsed table, or `undefined` when the section declares no combinations at all.
 * @returns One record per table row, or `[]` when there is no table.
 */
function rowsFromTable(table: DataTable | undefined): Record<string, string>[] {
    if (!table) return []
    return table.rows.map(row =>
        Object.fromEntries(table.columns.map((column, index) => [column, (row[index] ?? "").trim()]))
    )
}

/**
 * Turns a `### Values` list into the `dataValues` map, and declares any attribute the list names
 * but the `## Data` attribute list does not — a `### Values` entry doubles as a declaration, the
 * way a combinations table's column header does.
 *
 * @param attributeValues Parsed `### Values` entries.
 * @param data Attribute-to-description map to complete (mutated in place).
 * @returns The values each attribute may take, keyed by attribute name.
 */
function dataValuesFromSection(
    attributeValues: AttributeValues[],
    data: Record<string, string>
): Record<string, string[]> {
    for (const { name } of attributeValues) if (!(name in data)) data[name] = ""
    return Object.fromEntries(attributeValues.map(({ name, values }) => [name, values]))
}

type ImpliedCondition = {
    attribute: string
    condition: Condition
}

/**
 * A condition or result's right-hand side: either a literal `value`, or a `value` naming a
 * reference. Mirrors the grammar's `attributeValue` rule, shared between
 * `conditionalAttributeExpression` and `resultAttributeExpression`.
 */
type ValueExpression = Pick<Condition, "value" | "valueIsReference">

type TransitionRow = {
    id?: string
    states: StateRef[]
    trigger: Trigger
    result: StateRef
    notes?: string
}

/**
 * The four States/Trigger/Result/Notes sub-blocks of a list-form transition entry, shared by the
 * `withDescription` and `withoutDescription` cases of `transitionListEntry` — everything but the
 * id, which each case reads (and, for `withDescription`, folds a description into `notes`) on its
 * own.
 */
type TransitionListBody = Omit<TransitionRow, "id">

type TransitionsSection = {
    transitions: TransitionRow[]
    impossible: ImpossibleTrigger[]
    irrelevant: IrrelevantTrigger[]
    defaultPreconditions: {
        state: string
        description?: string
    }[]
}

// --- Argument helper ---

/**
 * Builds one `Argument` from the parsed qualifier/modifier/qualifier fields,
 * a `ArgumentExpression`, and optional suffix text. Field order mirrors source order.
 * `condition` (a state/trigger argument) and `result` (a transition result argument) are
 * mutually exclusive — only one is ever set on a given expression.
 */
type ArgumentExpression = {
    name: string
    condition?: Condition
    result?: Result
}

type BuildArgumentOptions = {
    qualifier?: string
    preQualifier?: string
    modifier?: string
    postQualifier?: string
    expression: ArgumentExpression
    suffix?: string
}

/**
 * Builds one `Argument` from parsed qualifier, modifier, and expression fields.
 *
 * Constructs an `Argument` object by selectively including qualifier, modifier,
 * and suffix fields only when they are defined, preserving source order.
 *
 * @param qualifier Optional qualifier for the argument.
 * @param preQualifier Optional pre-qualifier before the modifier.
 * @param modifier Optional modifier for the argument.
 * @param postQualifier Optional post-qualifier after the modifier.
 * @param expression The argument name and optional condition or result.
 * @param suffix Optional suffix text appended to the argument.
 * @returns An `Argument` object with all provided fields set.
 */
function buildArgument({
                           qualifier,
                           preQualifier,
                           modifier,
                           postQualifier,
                           expression,
                           suffix
                       }: BuildArgumentOptions): Argument {
    const argument = {} as Argument
    if (qualifier) argument.qualifier = qualifier
    if (preQualifier) argument.preQualifier = preQualifier
    if (modifier) argument.modifier = modifier
    if (postQualifier) argument.postQualifier = postQualifier
    argument.name = expression.name
    if (expression.condition) argument.condition = expression.condition
    if (expression.result) argument.result = expression.result
    if (suffix) argument.suffix = suffix
    return argument
}

/**
 * Reads the literal words trailing an argument, for either suffix flavour: the plain
 * `argumentSuffix` of a table cell, or the `argumentSuffixBeforeDescription` of a list entry that
 * carries its own description.
 *
 * @param tokensIter Iteration node holding the suffix characters.
 * @returns The trimmed suffix text, or `undefined` when the suffix holds no words.
 */
function argumentSuffixText(tokensIter: ohm.IterationNode): string | undefined {
    return tokensIter.sourceString.trim() || undefined
}

/**
 * Builds a range condition, keeping the bracket characters the author wrote: they carry each
 * bound's inclusivity, which no other part of the condition records. The bounds and their
 * brackets are rendered into one value string, e.g. `[1, 4)` for a range that includes `1` and
 * excludes `4`.
 *
 * @param attributeNode Node holding the constrained attribute's name.
 * @param rangeOperatorNode Node holding the range operator (`in range` / `not in range`).
 * @param openNode Node holding the opening bracket, `[` or `(`.
 * @param lowNode Node holding the lower bound.
 * @param highNode Node holding the upper bound.
 * @param closeNode Node holding the closing bracket, `]` or `)`.
 * @returns The attribute name with its range condition.
 */
function buildRangeCondition(
    attributeNode: ohm.Node,
    rangeOperatorNode: ohm.Node,
    openNode: ohm.Node,
    lowNode: ohm.Node,
    highNode: ohm.Node,
    closeNode: ohm.Node,
): ImpliedCondition {
    const openBracket = openNode.sourceString.trim()
    const closeBracket = closeNode.sourceString.trim()
    const low = String(lowNode.toAST())
    const high = String(highNode.toAST())
    return {
        attribute: attributeNode.toAST() as string,
        condition: {
            operator: rangeOperatorNode.toAST() as Condition["operator"],
            value: `${openBracket}${low}, ${high}${closeBracket}`,
        },
    } satisfies ImpliedCondition
}

// --- Whitespace cleanup ---

/**
 * Split the sub-bullets of a state declaration into its implied conditions and its implied states.
 *
 * @param entries Parsed sub-bullets: a condition object, or a bare state name.
 * @returns The `impliedConditions` and `impliedStates` properties, each only when non-empty.
 */
function splitImpliedEntries(entries: ImpliedEntry[] | undefined): {
    impliedConditions?: ImpliedCondition[]
    impliedStates?: string[]
} {
    const impliedConditions = (entries ?? []).filter((entry): entry is ImpliedCondition => typeof entry !== "string")
    const impliedStates = (entries ?? []).filter((entry): entry is string => typeof entry === "string")
    return {
        ...(impliedConditions.length > 0 ? { impliedConditions } : {}),
        ...(impliedStates.length > 0 ? { impliedStates } : {})
    }
}

/**
 * Normalizes whitespace in text by replacing HTML breaks and collapsing spaces.
 *
 * Removes HTML `<br>` tags, collapses multiple whitespace sequences into single
 * spaces, and trims leading/trailing whitespace.
 *
 * @param text The text to normalize.
 * @returns The normalized text with standardized whitespace.
 */
function normalizeWhitespace(text: string): string {
    return text
        .replace(/<br\s*\/?\s*>/gi, " ")
        .replace(/\s+/g, " ")
        .trim()
}

// --- ---

/**
 * Creates Ohm semantics with a `toAST` operation that transforms the parse
 * tree into a clean JSON-serializable AST.
 *
 * @param grammar The Ohm grammar to attach semantics to.
 * @returns The semantics object with `toAST` operation registered.
 */
export function createSemantics(grammar: ohm.Grammar): ohm.Semantics {
    const semantics = grammar.createSemantics()

    /**
     * Re-parses one joined logical line from a list-form transition entry (a state reference,
     * trigger, or result) using the grammar's own `trigger`/`result` rule — the same rule a table
     * cell is parsed with — so list-form and table-form entries share identical argument,
     * modifier, and condition handling.
     *
     * @param itemNode The original `listItemValue` parse node the text was derived from, used to
     *                 translate a failure position back to its real line/column in the source file.
     * @param ruleName The grammar start rule to parse the item's normalized text with.
     * @returns The resulting AST node (a `StateRef` or `Trigger`, depending on `ruleName`).
     * @throws Error when the normalized text does not match the given rule.
     */
    function reparseListValue<T>(itemNode: ohm.Node, ruleName: "trigger" | "result"): T {
        const text = itemNode.toAST() as string
        const matchResult = grammar.match(text, ruleName)
        if (matchResult.failed()) {
            // `text` is a normalized, single-line copy of the item's source, so ohm reports
            // failures relative to it (always "Line 1"). Re-anchor the failure position onto the
            // item's own first-line source interval to report the real line/column instead.
            const contentSource = itemNode.child(1).source
            const failureOffset = matchResult.getRightmostFailurePosition()
            const location = contentSource.subInterval(failureOffset, 0).getLineAndColumnMessage()
            throw new Error(
                `Failed to parse list-form transition value \`${text}\`: ${location}Expected ${matchResult.getExpectedText()}`
            )
        }
        return semantics(matchResult).toAST() as T
    }

    // noinspection JSUnusedGlobalSymbols,SpellCheckingInspection
    semantics.addOperation<unknown>("toAST", {

        // --- Top-level ---

        /**
         * Transforms the top-level state machine parse tree into a `StateMachine` AST.
         *
         * Extracts and normalizes all sections (title, overview, states, data,
         * transitions) and constructs a complete state machine object with defaults
         * for optional fields.
         *
         * @param _preambleNode Preamble section (unused).
         * @param titleNode Parse node for the machine title.
         * @param overviewNode Parse node for the machine overview.
         * @param statesNode Parse node for the states section.
         * @param dataNode Parse node for the data section.
         * @param transitionsNode Parse node for the transitions section.
         * @param _notesNode Notes section (unused).
         * @returns The constructed `StateMachine` object ready for validation.
         */
        stateMachineFile(
            _preambleNode,
            titleNode,
            overviewNode,
            statesNode,
            dataNode,
            transitionsNode,
            _notesNode
        ) {
            const title = titleNode.toAST() as string
            const stateSection = statesNode.toAST() as StatesSection
            const states = stateSection.states.map(state => {
                const { impliedConditions, impliedStates, ...rest } = state
                return {
                    ...rest,
                    ...(impliedConditions?.length ? { impliedConditions } : {}),
                    ...(impliedStates?.length ? { impliedStates } : {})
                } as StateDefinition
            }) as [StateDefinition, ...StateDefinition[]]
            const dataSection = dataNode.children[0]?.toAST() as DataSection | undefined
            const transitions = transitionsNode.toAST() as TransitionsSection

            const machine: StateMachine = {
                name: title,
                overview: (() => {
                    let overview = overviewNode.children[0]?.toAST()
                    if (!overview) return null
                    overview = normalizeWhitespace(String(overview))
                    return overview.length > 0 ? overview : null
                })(),
                states,
                data: dataSection?.data ?? {},
                ...(dataSection?.dataValues ? { dataValues: dataSection.dataValues } : {}),
                dataValueCombinations: dataSection?.dataValueCombinations ?? [],
                defaultPreconditions: transitions.defaultPreconditions ?? [],
                transitions: transitions.transitions as unknown as Transition[],
                impossible: { defined: transitions.impossible ?? [] },
                irrelevant: transitions.irrelevant ?? []
            }
            if (stateSection.initialState !== undefined) {
                machine.initialState = stateSection.initialState
            }
            return machine
        },

        title(_h1, nameNode, _terminateLine) {
            return nameNode.sourceString.trim().toLowerCase()
        },

        // Cleans and returns the `InlineText`, ignoring any trailing comment.
        inlineText(chars, _inlineCommentOpt) {
            return chars.sourceString
        },

        overview(textIterator, _eolIter) {
            const texts = textIterator.children.map(node => node.toAST() as string)
            return texts.length > 0 ? normalizeWhitespace(texts.join(" ")) : null
        },

        text(textChars, _commentOpt) {
            return textChars.sourceString
        },

        // --- States ---

        statesSection(_h2, _kw, _terminateLine, bodyNode, _notes) {
            return bodyNode.toAST()
        },

        stateSectionBody(declarations, _ignoredLineIter, initialLine) {
            const initialStateNode = initialLine.children[0]
            return {
                states: declarations.children.map(declaration => declaration.toAST()),
                ...(initialStateNode ? { initialState: initialStateNode.toAST() as string } : {})
            }
        },

        stateDeclaration_withoutDescription(_li, nameNode, _commentOpt, _nl, impliedConditionsNode) {
            return {
                name: nameNode.toAST() as string,
                description: null,
                ...splitImpliedEntries(impliedConditionsNode.toAST() as ImpliedEntry[])
            }
        },

        stateDeclaration_bare(_li, nameNode, _commentOpt, _terminateLine) {
            return {
                name: nameNode.toAST() as string,
                description: null
            }
        },

        stateDeclaration_withDescription(_li, nameNode, descriptionNode, impliedConditionsOpt) {
            return {
                name: nameNode.toAST() as string,
                description: descriptionNode.toAST() as string | null,
                ...splitImpliedEntries(impliedConditionsOpt.children[0]?.toAST() as ImpliedEntry[] | undefined)
            }
        },

        stateDescription(_colon, linesIter, _ignoredLineIter) {
            const lines = linesIter.toAST() as (string | null)[]
            const joined = normalizeWhitespace(lines.filter((line): line is string => Boolean(line)).join(" "))
            return joined.length > 0 ? joined : null
        },

        stateDescriptionLine(textIter, _commentOpt, _nl) {
            return textIter.sourceString
        },

        description(_colon, linesIter, _ignoredLineIter) {
            const lines = linesIter.toAST() as (string | null)[]
            const joined = normalizeWhitespace(lines.filter((line): line is string => Boolean(line)).join(" "))
            return joined.length > 0 ? joined : null
        },

        // Description lines are normalized uniformly for states, attributes, and defaults.
        descriptionLine(textIter, _commentOpt, _nl) {
            return textIter.sourceString
        },

        initialStateLine(_kw, nameNode, _commentOpt, _terminateLine) {
            return nameNode.toAST() as string
        },

        impliedConditions(_bulletIter, entriesIter, _commentIter, _eolIter) {
            return entriesIter.children.map((node: ohm.NonterminalNode) => node.toAST())
        },

        impliedEntry_condition(conditionNode) {
            return conditionNode.toAST() as ImpliedCondition
        },

        impliedEntry_state(nameNode) {
            return nameNode.toAST() as string
        },

        // --- Data ---

        dataSection(_h2, _kw, _terminateLine, bodyNode, _notes) {
            return bodyNode.toAST()
        },

        dataSectionBody_none(_none, _terminateLine) {
            return { data: {}, dataValueCombinations: [] }
        },

        dataSectionBody_valuesOnly(valuesNode, combinationsNode) {
            if (combinationsNode.children.length > 0) throw new Error(VALUES_WITH_VALUE_COMBINATIONS_TABLE)
            const data: Record<string, string> = {}
            const dataValues = dataValuesFromSection(valuesNode.toAST() as AttributeValues[], data)
            return { data, dataValueCombinations: [], dataValues }
        },

        dataSectionBody_combinationsOnly(combinationsNode) {
            return { data: {}, dataValueCombinations: rowsFromTable(combinationsNode.toAST() as DataTable) }
        },

        dataSectionBody_withEntries(attributesNode, valuesNode, combinationsNode) {
            const dataAttributes = attributesNode.children.map(attribute => attribute.toAST()) as DataAttribute[]
            const attributeValues = valuesNode.children[0]?.toAST() as AttributeValues[] | undefined
            const table = combinationsNode.children[0]?.toAST() as DataTable | undefined

            const data: Record<string, string> = {}
            for (const dataAttribute of dataAttributes) {
                data[dataAttribute.name] = dataAttribute.description ?? ""
            }

            if (attributeValues && table) throw new Error(VALUES_WITH_VALUE_COMBINATIONS_TABLE)

            // Deriving the rows from the value lists is left to the complete step, which owns every
            // other example-value derivation (and the cap on how many rows may be derived).
            if (attributeValues) {
                return { data, dataValueCombinations: [], dataValues: dataValuesFromSection(attributeValues, data) }
            }

            return { data, dataValueCombinations: rowsFromTable(table) }
        },

        attribute_withoutDescription(_li, nameNode, _commentOpt, _terminateLine) {
            return { name: nameNode.toAST() as string, description: null }
        },

        attribute_withDescription(_li, nameNode, descriptionNode) {
            return { name: nameNode.toAST() as string, description: descriptionNode.toAST() as string }
        },

        valuesSection(_h3, _kw, _terminateLine, entriesNode) {
            return entriesNode.children.map((entry: ohm.NonterminalNode) => entry.toAST() as AttributeValues)
        },

        attributeValues(_li, nameNode, _colon, _hsp, firstNode, _commaIter, restIter, _commentOpt, _terminateLine) {
            const values = [firstNode, ...restIter.children].map(node => String(node.toAST()))
            return { name: nameNode.toAST() as string, values } satisfies AttributeValues
        },

        declaredValue_literal(valueNode) {
            return String(valueNode.toAST())
        },

        // `""` is how the AST encodes an absent value, the same as an empty combinations-table cell.
        declaredValue_undefined(_keyword) {
            return ""
        },

        valueCombinationsSection(_h3, _kw, _terminateLine, tableNode) {
            return tableNode.toAST() as DataTable
        },

        attributeValuesTable(headerNode, _sep, rows, _ignoredLineIter) {
            return {
                columns: headerNode.toAST() as string[],
                rows: rows.children.map((row: ohm.NonterminalNode) => row.toAST() as string[])
            }
        },

        attributeValuesTableHeader(_pipe, identifierIter, _inlineCommentIter, _pipeIter, _trailingComment, _nl) {
            return identifierIter.children.map((node: ohm.NonterminalNode) => node.toAST() as string)
        },

        attributeValuesTableRow(_pipe, cellsIter, _commentOpts, _pipeIter, _trailingComment, _eol) {
            return cellsIter.children.map((cellOptNode: ohm.NonterminalNode) => {
                const inner = (cellOptNode as unknown as { children: ohm.NonterminalNode[] }).children
                if (!inner || inner.length === 0) return ""
                return String(inner[0].toAST()).trim()
            })
        },

        // --- Default preconditions  ---

        defaultPreconditions(_h3, _kw, _terminateLine, bodyNode) {
            return bodyNode.toAST()
        },

        defaultPreconditionsBody_none(_none, _terminateLine) {
            return []
        },

        defaultPreconditionsBody_withEntries(entriesNode) {
            return entriesNode.children.map(entry => entry.toAST())
        },

        defaultPrecondition_withDescription(_li, stateRefNode, descriptionNode) {
            const ref = stateRefNode.toAST() as StateRef
            return {
                state: ref.name,
                ...(ref.arguments ? { arguments: ref.arguments } : {}),
                description: descriptionNode.toAST() as string
            }
        },

        defaultPrecondition_withoutDescription(_li, stateRefNode, _commentOpt, _terminateLine) {
            const ref = stateRefNode.toAST() as StateRef
            return {
                state: ref.name,
                ...(ref.arguments ? { arguments: ref.arguments } : {})
            }
        },

        // --- Transitions ---

        transitionsSection(_h2, _kw, _terminateLine, bodyNode, _notes) {
            return bodyNode.toAST()
        },

        transitionsSectionBody(defaultPreconditionsNode, rulesNode, impossibleNode, irrelevantNode) {
            return {
                transitions: rulesNode.toAST() as TransitionRow[],
                impossible: impossibleNode.children[0]?.toAST() ?? [],
                irrelevant: irrelevantNode.children[0]?.toAST() ?? [],
                defaultPreconditions: defaultPreconditionsNode.children[0]?.toAST() ?? []
            }
        },

        transitionRules(_h3, _kw, _terminateLine, bodyNode) {
            return bodyNode.toAST()
        },

        // Merges the table-form and list-form blocks of a `### Rules` subsection into one flat
        // list of transitions, in source order.
        transitionRulesBody(blocksIter) {
            const rows: TransitionRow[] = []
            for (const blockNode of blocksIter.children) {
                const block = blockNode.toAST() as TransitionRow | TransitionRow[]
                if (Array.isArray(block)) rows.push(...block)
                else rows.push(block)
            }
            return rows
        },

        transitionsTable(_header, _sep, rows, _ignoredLineIter) {
            return rows.children.map(row => row.toAST())
        },

        transitionRow(_pipe, idNodeOpt, _idCommentOpt, _idPipeOpt, statesCell, _statesCommentOpt, _pipe1, triggerCell, _triggerCommentOpt, _pipe2, resultCell, _resultCommentOpt, _pipe3, notesTokenIter, _notesCommentOpt, _notesPipeOpt, _eol) {
            const rawId = idNodeOpt.children[0]?.toAST() as string | string[] | undefined
            const id = Array.isArray(rawId)
                ? rawId.map(part => String(part)).join("").trim()
                : rawId?.trim()
            const states = statesCell.toAST() as StateRef[]
            const trigger = triggerCell.toAST() as Trigger
            const result = resultCell.toAST() as StateRef
            const notes = notesTokenIter.children.length > 0
                ? normalizeWhitespace(notesTokenIter.children.map(
                    (node: ohm.NonterminalNode) => String(node.toAST())).join(""))
                : undefined
            return {
                ...(id ? { id } : {}),
                states, trigger, result,
                ...(notes ? { notes } : {})
            }
        },

        transitionId(_firstChar, _remainingChars) {
            return this.sourceString.trim()
        },

        // --- Transition rules (list form) ---

        // A description following the id's `:` folds into the transition's `notes`, ahead of any
        // text from an explicit `- Notes:` sub-block.
        transitionListEntry_withDescription(_li, idNode, descriptionNode, bodyNode) {
            const id = idNode.sourceString.trim()
            const description = descriptionNode.toAST() as string | null
            const body = bodyNode.toAST() as TransitionListBody
            const notes = [description, body.notes].filter((text): text is string => Boolean(text)).join(" ")
            return {
                id, states: body.states, trigger: body.trigger, result: body.result,
                ...(notes ? { notes } : {})
            }
        },

        transitionListEntry_withoutDescription(_li, idNode, _colon, _commentOpt, _eol, bodyNode) {
            const id = idNode.sourceString.trim()
            const body = bodyNode.toAST() as TransitionListBody
            return {
                id, states: body.states, trigger: body.trigger, result: body.result,
                ...(body.notes ? { notes: body.notes } : {})
            }
        },

        transitionListBody(statesBlock, triggerBlock, resultBlock, notesBlockOpt, _ignoredLineIter) {
            return {
                states: statesBlock.toAST() as StateRef[],
                trigger: triggerBlock.toAST() as Trigger,
                result: resultBlock.toAST() as StateRef,
                notes: notesBlockOpt.children[0]?.toAST() as string | undefined
            } satisfies TransitionListBody
        },

        transitionListStatesBlock(_sub, _kw, _eol, itemsIter) {
            return itemsIter.children.map(node => reparseListValue<StateRef>(node, "trigger"))
        },

        transitionListTriggerBlock(_sub, _kw, _eol, itemNode) {
            return reparseListValue<Trigger>(itemNode, "trigger")
        },

        transitionListResultBlock(_sub, _kw, _eol, itemNode) {
            return reparseListValue<StateRef>(itemNode, "result")
        },

        transitionListNotesBlock(_sub, _kw, _eol, itemsIter) {
            const lines = itemsIter.children.map(node => node.toAST() as string)
            return normalizeWhitespace(lines.join(" "))
        },

        listItemValue(_sub, textIter, _commentOpt, _nl, continuationIter) {
            const lines = [textIter.sourceString, ...continuationIter.children.map(node => node.toAST() as string)]
            return normalizeWhitespace(lines.join(" "))
        },

        continuationLine(textIter, _commentOpt, _nl) {
            return textIter.sourceString
        },

        // --- State combinations & references ---

        stateCombination(headNode, _commaIter, tailIter) {
            return [
                headNode.toAST() as StateRef,
                ...tailIter.children.map((node: ohm.NonterminalNode) => node.toAST() as StateRef)
            ]
        },

        stateReference(identifierNode, firstArgOpt, _separatorIter, moreArgsIter) {
            const firstArg = firstArgOpt.children.length > 0 ? firstArgOpt.children[0].toAST() as Argument : undefined
            const moreArgs = moreArgsIter.children.map(node => node.toAST() as Argument)
            const args = [...(firstArg !== undefined ? [firstArg] : []), ...moreArgs]
            const name = identifierNode.toAST() as string
            return args.length > 0 ? { name, arguments: args } : { name }
        },

        // --- Arguments ---

        argument_withModifier(_leadingSpace, preQualifierOpt, modifierNode, postQualifierOpt, argumentExpression, suffixOpt) {
            const preQualifier = preQualifierOpt.children[0] ? preQualifierOpt.children[0].sourceString.trim() : undefined
            const modifier = modifierNode.sourceString.trim()
            const postQualifier = postQualifierOpt.children[0] ? postQualifierOpt.children[0].sourceString.trim() : undefined
            const suffix = suffixOpt.children[0]?.toAST() as string | undefined
            const expression = argumentExpression.toAST() as ArgumentExpression
            return buildArgument({ preQualifier, modifier, postQualifier, expression, suffix })
        },

        argument_noModifier(_leadingSpace, qualifierOpt, argumentExpression, suffixOpt) {
            const qualifier = qualifierOpt.children[0] ? qualifierOpt.children[0].sourceString.trim() : undefined
            const suffix = suffixOpt.children[0]?.toAST() as string | undefined
            const expression = argumentExpression.toAST() as ArgumentExpression
            return buildArgument({ qualifier, expression, suffix })
        },

        argumentSuffix(tokensIter) {
            return argumentSuffixText(tokensIter)
        },

        argumentSuffixBeforeDescription(tokensIter) {
            return argumentSuffixText(tokensIter)
        },

        argumentExpression_conditional(expressionNode) {
            const { attribute, condition } = expressionNode.toAST() as ImpliedCondition
            return { name: attribute, condition }
        },

        argumentExpression_bare(nameNode) {
            return { name: nameNode.toAST() as string }
        },

        // --- Conditions ---

        conditionalAttributeExpression_range(attributeNode, rangeOpNode, openNode, lowNode, _comma, highNode, closeNode) {
            return buildRangeCondition(attributeNode, rangeOpNode, openNode, lowNode, highNode, closeNode)
        },

        conditionalAttributeExpression_rangeLeftOpen(attributeNode, rangeOpNode, openNode, lowNode, _comma, highNode, closeNode) {
            return buildRangeCondition(attributeNode, rangeOpNode, openNode, lowNode, highNode, closeNode)
        },

        conditionalAttributeExpression_set(attributeNode, setCompareNode, _lp, headNode, _commaIter, tailIter, _rp) {
            return {
                attribute: attributeNode.toAST() as string,
                condition: {
                    operator: setCompareNode.toAST() as Condition["operator"],
                    value: [
                        String(headNode.toAST()),
                        ...tailIter.children.map((n: ohm.NonterminalNode) => String(n.toAST()))
                    ]
                }
            } satisfies ImpliedCondition
        },

        conditionalAttributeExpression_numericComparison(attributeNode, opNode, valueNode) {
            return {
                attribute: attributeNode.toAST() as string,
                condition: {
                    operator: opNode.sourceString.trim() as Condition["operator"],
                    ...(valueNode.toAST() as ValueExpression)
                }
            } satisfies ImpliedCondition
        },

        conditionalAttributeExpression_sameness(attributeNode, _compareNode, referenceNode) {
            return {
                attribute: attributeNode.toAST() as string,
                condition: { operator: "as", value: referenceNode.toAST() as string, valueIsReference: true }
            } satisfies ImpliedCondition
        },

        conditionalAttributeExpression_textComparison(attributeNode, compareNode, valueNode) {
            let operator = compareNode.sourceString.trim()
            switch (operator) {
                case "is":
                case "are":
                    operator = "="
                    break
                case "is not":
                case "are not":
                    operator = "<>"
                    break
                default:
                    throw new Error(`Unsupported operator \`${operator}\``)
            }
            return {
                attribute: attributeNode.toAST() as string,
                condition: { operator: operator as Condition["operator"], ...(valueNode.toAST() as ValueExpression) }
            } satisfies ImpliedCondition
        },

        conditionalAttributeExpression_undefined(attributeNode, _kw) {
            return {
                attribute: attributeNode.toAST() as string,
                condition: { operator: "undefined" }
            } satisfies ImpliedCondition
        },

        conditionalAttributeExpression_defined(attributeNode, _kw) {
            return {
                attribute: attributeNode.toAST() as string,
                condition: { operator: "defined" }
            } satisfies ImpliedCondition
        },

        rangeOperator_in(_kw) {
            return "in range"
        },

        rangeOperator_notIn(_kw) {
            return "not in range"
        },

        textCompare_is(_op) {
            return "="
        },

        textCompare_isNot(_op) {
            return "<>"
        },

        setCompare_in(_op) {
            return "in"
        },

        setCompare_notIn(_op) {
            return "not in"
        },

        // --- Result reference ---

        result(identifierNode, firstArgOpt, _separatorIter, moreArgsIter) {
            const firstArg = firstArgOpt.children.length > 0 ? firstArgOpt.children[0].toAST() as Argument : undefined
            const moreArgs = moreArgsIter.children.map(node => node.toAST() as Argument)
            const args = [...(firstArg !== undefined ? [firstArg] : []), ...moreArgs]
            const name = identifierNode.toAST() as string
            return args.length > 0 ? { name, arguments: args } : { name }
        },

        resultArgument_withModifier(_leadingSpace, preQualifierOpt, modifierNode, postQualifierOpt, resultArgumentExpression, suffixOpt) {
            const preQualifier = preQualifierOpt.children[0] ? preQualifierOpt.children[0].sourceString.trim() : undefined
            const modifier = modifierNode.sourceString.trim()
            const postQualifier = postQualifierOpt.children[0] ? postQualifierOpt.children[0].sourceString.trim() : undefined
            const suffix = suffixOpt.children[0]?.toAST() as string | undefined
            const expression = resultArgumentExpression.toAST() as ArgumentExpression
            return buildArgument({ preQualifier, modifier, postQualifier, expression, suffix })
        },

        resultArgument_noModifier(_leadingSpace, qualifierOpt, resultArgumentExpression, suffixOpt) {
            const qualifier = qualifierOpt.children[0] ? qualifierOpt.children[0].sourceString.trim() : undefined
            const suffix = suffixOpt.children[0]?.toAST() as string | undefined
            const expression = resultArgumentExpression.toAST() as ArgumentExpression
            return buildArgument({ qualifier, expression, suffix })
        },

        resultArgumentExpression_conditional(expressionNode) {
            const { attribute, result } = expressionNode.toAST() as { attribute: string; result: Result }
            return { name: attribute, result }
        },

        resultArgumentExpression_bare(nameNode) {
            return { name: nameNode.toAST() as string }
        },

        resultAttributeExpression_value(attributeNode, _kw, valueNode) {
            return {
                attribute: attributeNode.toAST() as string,
                result: { ...(valueNode.toAST() as ValueExpression) },
            }
        },

        resultAttributeExpression_undefined(attributeNode, _kw, _undefinedKw) {
            return {
                attribute: attributeNode.toAST() as string,
                result: {},
            }
        },

        // --- Impossible / Irrelevant ---

        impossibleBlock(_h3, _kw, _terminateLine, bodyNode) {
            return bodyNode.toAST()
        },

        impossibleBlockBody_none(_none, _terminateLine) {
            return []
        },

        impossibleBlockBody_table(tableNode) {
            return tableNode.toAST()
        },

        irrelevantBlock(_h3, _kw, _terminateLine, bodyNode) {
            return bodyNode.toAST()
        },

        irrelevantBlockBody_none(_none, _terminateLine) {
            return []
        },

        irrelevantBlockBody_table(tableNode) {
            return tableNode.toAST()
        },

        nonTriggerablesTable(_pipe, _header, _pipe2, _trig, _pipe3, _nl, _sep, rows, _ignoredLineIter) {
            return rows.children.map(row => row.toAST())
        },

        nonTriggerablesTableRow(_pipe, combo, _comboCommentOpt, _pipe2, trigger, _triggerCommentOpt, _pipe3, _eol) {
            return {
                states: (combo.toAST() as StateRef[]).map(state => state.name),
                trigger: trigger.toAST() as Trigger,
            }
        },

        // --- Triggers ---

        trigger(stateRefNode) {
            return stateRefNode.toAST() as Trigger
        },

        // --- Identifiers/values ---

        identifier(_open, chars, _close) {
            return chars.sourceString.trim().toLowerCase()
        },

        string(_open, chars, _close) {
            return chars.sourceString
        },

        attributeValue_literal(valueNode) {
            return { value: String(valueNode.toAST()) } satisfies ValueExpression
        },

        attributeValue_reference(identifierNode) {
            return { value: identifierNode.toAST() as string, valueIsReference: true } satisfies ValueExpression
        },

        number(_signOpt, _intOrDot, _fracOrDigits, _exponentOpt) {
            return this.sourceString
        },

        // --- Defaults ---

        _iter(...children) {
            return children.map(child => child.toAST())
        },

        _terminal() {
            return this.sourceString
        },

        _nonterminal(...children) {
            if (children.length === 1) return children[0].toAST()
            return children.map(child => child.toAST())
        }
    })

    return semantics
}

// --- File I/O ---

/**
 * Reads the JSON file and returns the contained state machines.
 *
 * @param file - JSON file name (path).
 * @returns The list of `StateMachine` instances parsed from the JSON file.
 * @throws Error when the file is missing, unreadable, or not valid JSON.
 */
export function loadStateMachines(file: string): StateMachine[] {
    const source = readFileSync(file, "utf8")
    const dataStruct = JSON.parse(source) as { stateMachines: StateMachine[] }
    return dataStruct.stateMachines
}

/**
 * Writes the given state machines to the JSON file.
 *
 * @param file - JSON file name (path).
 * @param stateMachines - The state machines to serialize.
 */
export function saveStateMachines(file: string, stateMachines: StateMachine[]): void {
    const dataStruct = {stateMachines}
    writeFileSync(file, JSON.stringify(dataStruct, null, 2), "utf8")
}
