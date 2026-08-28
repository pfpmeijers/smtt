# Results from: scenario-label.test.ts, TST-060: Scenario label lower case
# State machines:
#  - name: m
#    states:
#      - name: s1
#      - name: s2
#    dataExampleValues:
#      - a: A
#    transitions:
#      - id: "001"
#        states:
#          - name: s1
#        trigger:
#          type: event
#          name: e
#          arguments:
#            - qualifier: with
#              name: a
#              condition:
#                operator: =
#                value: A
#        result:
#          name: s2
# Covers requirements:
# - [REQ-028] The scenario label part following the ID shall be rendered in lower case. Lower-casing
#   applies to textual name tokens (state names, trigger names, qualifier words, attribute names).
# - [REQ-047] When any state, the trigger, or an applicable default precondition carries
#   argument(s), the scenario shall be emitted as a `Scenario Outline` with an examples table
#   (described further down), instead of a `Scenario`.
# - [REQ-048] The generator shall add the arguments information after the state name.
# - [REQ-057] `$qualifier` shall be a single qualifier before the attribute name, in case no
#   modifier is given.
# - [REQ-058] The `$qualifier` shall be taken from AST path
#   `[i].transitions[j].states[*].arguments[*].qualifier`.
# - [REQ-061] `$attribute-name` shall be the name of a state's data attribute, present as a column
#   in the `Examples:` table below the step definitions.
# - [REQ-062] The `$attribute-name` shall be taken from AST path
#   `[i].transitions[j].states[*].arguments[*].name`.

Feature: m

  Scenario Outline: [001] s1 → s2; when e with "<a>"
    Given initially s1
    When e with "<a>"
    Then expect s2
    Examples:
      | a |
      | A |
