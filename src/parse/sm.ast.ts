import { readFileSync, writeFileSync } from "fs";
import * as ohm from "ohm-js"
import {
    Argument,
    Condition,
    ImpossibleTrigger,
    IrrelevantTrigger,
    StateDefinition,
    StateMachine,
    StateRef,
    Transition,
    Trigger
} from "./sm.ast.d"

// --- Input sections not converted into output ---

type StatesSection = {
    states: {
        name: string;
        description: string | null;
        impliedConditions?: ImpliedCondition[]
    }[]
    initialState?: string
}

type DataAttribute = {
    name: string;
    description: string | null
}

type DataSection = {
    data: Record<string, string>
    dataExampleValues: Record<string, string>[]
}

type DataTable = {
    columns: string[]
    rows: string[][]
}

type ImpliedCondition = {
    attribute: string
    condition: Condition
}

type TransitionRow = {
    id?: string
    states: StateRef[]
    trigger: Trigger
    result: StateRef
    notes?: string
}

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
 */
type ArgumentExpression = {
    name: string
    condition?: Condition
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
 * @param expression The argument name and optional condition.
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
    if (suffix) argument.suffix = suffix
    return argument
}

// --- Whitespace cleanup ---

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
                const { impliedConditions, ...rest } = state
                if (!impliedConditions?.length) return rest as StateDefinition
                return { ...rest, impliedConditions } as StateDefinition
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
                dataExampleValues: dataSection?.dataExampleValues ?? [],
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
            const impliedConditions = impliedConditionsNode.toAST() as ImpliedCondition[]
            return {
                name: nameNode.toAST() as string,
                description: null,
                ...(impliedConditions && impliedConditions.length > 0 ? { impliedConditions } : {})
            }
        },

        stateDeclaration_bare(_li, nameNode, _commentOpt, _terminateLine) {
            return {
                name: nameNode.toAST() as string,
                description: null
            }
        },

        stateDeclaration_withDescription(_li, nameNode, descriptionNode, impliedConditionsOpt) {
            const impliedConditions = impliedConditionsOpt.children[0]?.toAST() as ImpliedCondition[] | undefined
            return {
                name: nameNode.toAST() as string,
                description: descriptionNode.toAST() as string | null,
                ...(impliedConditions && impliedConditions.length > 0 ? { impliedConditions } : {})
            }
        },

        stateDescription(_colon, linesIter) {
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

        impliedConditions(_bulletIter, conditionsIter, _commentIter, _eolIter) {
            return conditionsIter.children.map((node: ohm.NonterminalNode) => node.toAST())
        },

        // --- Data ---

        dataSection(_h2, _kw, _terminateLine, bodyNode, _notes) {
            return bodyNode.toAST()
        },

        dataSectionBody_none(_none, _terminateLine) {
            return { data: {}, dataExampleValues: [] }
        },

        dataSectionBody_withEntries(attributesNode, tableNode) {
            const dataAttributes = attributesNode.children.map(attribute => attribute.toAST()) as DataAttribute[]
            const table = tableNode.children[0]?.toAST() as DataTable | undefined

            const data: Record<string, string> = {}
            for (const dataAttribute of dataAttributes) {
                data[dataAttribute.name] = dataAttribute.description ?? ""
            }

            const dataExampleValues = table
                ? table.rows.map(row => Object.fromEntries(table.columns.map((column, index) => [column, (row[index] ?? "").trim()])))
                : []

            return { data, dataExampleValues }
        },

        attribute_withoutDescription(_li, nameNode, _commentOpt, _terminateLine) {
            return { name: nameNode.toAST() as string, description: null }
        },

        attribute_withDescription(_li, nameNode, descriptionNode) {
            return { name: nameNode.toAST() as string, description: descriptionNode.toAST() as string }
        },

        attributeValuesTable(_keyword, _terminateLine, headerNode, _sep, rows, _ignoredLineIter) {
            return {
                columns: headerNode.toAST() as string[],
                rows: rows.children.map((row: ohm.NonterminalNode) => row.toAST() as string[])
            }
        },

        attributeValuesTableHeader(_pipe, identifierIter, _inlineCommentIter, _pipeIter, _nl) {
            return identifierIter.children.map((node: ohm.NonterminalNode) => node.toAST() as string)
        },

        attributeValuesTableRow(_pipe, cellsIter, _commentOpts, _pipeIter, _eol) {
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

        transitionRules(_h3, _kw, _terminateLine, table) {
            return table.toAST()
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

        transitionId(_chars) {
            return _chars.sourceString.trim().toLowerCase()
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
            return tokensIter.sourceString.trim() || undefined
        },

        argumentExpression_conditional(expressionNode) {
            const { attribute, condition } = expressionNode.toAST() as ImpliedCondition
            return { name: attribute, condition }
        },

        argumentExpression_bare(nameNode) {
            return { name: nameNode.toAST() as string }
        },

        // --- Conditions ---

        conditionalAttributeExpression_range(attributeNode, rangeOpNode, _lb, lowNode, _comma, highNode, _rb) {
            return {
                attribute: attributeNode.toAST() as string,
                condition: {
                    operator: rangeOpNode.toAST() as Condition["operator"],
                    value: [String(lowNode.toAST()), String(highNode.toAST())]
                }
            } satisfies ImpliedCondition
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
                    value: String(valueNode.toAST())
                }
            } satisfies ImpliedCondition
        },

        conditionalAttributeExpression_textComparison(attributeNode, compareNode, valueNode) {
            let operator = compareNode.sourceString.trim()
            switch (operator) {
                case "as":
                case "is":
                case "are":
                    operator = "as"
                    break
                case "not as":
                case "is not":
                case "are not":
                    operator = "not as"
                    break
                default:
                    throw new Error(`Unsupported operator \`${operator}\``)
            }
            return {
                attribute: attributeNode.toAST() as string,
                condition: { operator: operator as Condition["operator"], value: String(valueNode.toAST()) }
            } satisfies ImpliedCondition
        },

        conditionalAttributeExpression_undefined(attributeNode, _kw) {
            return {
                attribute: attributeNode.toAST() as string,
                condition: { operator: "undefined" }
            } satisfies ImpliedCondition
        },

        rangeOperator_in(_kw) {
            return "in range"
        },

        rangeOperator_notIn(_kw) {
            return "not in range"
        },

        textCompare_is(_op) {
            return "as"
        },

        textCompare_isNot(_op) {
            return "not as"
        },

        setCompare_in(_op) {
            return "in"
        },

        setCompare_notIn(_op) {
            return "not in"
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
