# Results from: implied-conditions.test.ts, TST-026: Implied conditions on a precondition state filter the examples table
# State machines:
#  - name: m
#    states:
#      - name: s
#        impliedConditions:
#          - attribute: a
#            condition:
#              operator: ">"
#              value: "5"
#    dataExampleValues:
#      - a: "1"
#      - a: "9"
#    transitions:
#      - states:
#          - name: s
#            arguments:
#              - name: a
#        trigger:
#          type: event
#          name: e
#        result:
#          name: s
#        notes: ""
# Covers requirements:
# - [REQ-148] The implied conditions declared on a state definition shall be used by the feature
#   generator: when that state is a precondition (`Given`) state of a transition, its implied
#   conditions shall filter the examples table rows in the same way as explicit
#   precondition-argument conditions (REQ-099/REQ-100).
# - [REQ-165] The implied conditions of a precondition state shall be taken from AST path
#   `[i].states[k].impliedConditions[*]`, where `k` is the index of the precondition state matched
#   by name against `[i].states[*].name`. This applies to every effective `Given` state of the
#   transition — explicit transition states, injected default preconditions, and the implied initial
#   state.
# - [REQ-166] Each implied condition's `$attribute-name` shall be taken from AST path
#   `[i].states[k].impliedConditions[*].attribute` and matched against the examples table column of
#   the same name. An implied condition on an attribute that is not present in the effective
#   examples table shall impose no filter.
# - [REQ-167] Each implied condition's operator and value shall be taken from AST path
#   `[i].states[k].impliedConditions[*].condition` and evaluated with the same operators as argument
#   conditions (REQ-090 through REQ-096). Implied conditions only filter rows; they neither add
#   columns nor turn a plain `Scenario` into a `Scenario Outline`.

Feature: m

  Scenario Outline: [] s "<a>" → s; when e
    Given initially s "<a>"
    When e
    Then expect s
    Examples:
      | a |
      | 9 |
