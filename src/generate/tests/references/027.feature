# Results from: implied-conditions.test.ts, TST-027: Implied condition on an attribute absent from the examples imposes no filter
# State machines:
#  - name: m
#    states:
#      - name: s
#        impliedConditions:
#          - attribute: b
#            condition:
#              operator: ">"
#              value: "5"
#    dataExampleValues:
#      - a: "1"
#        b: "5"
#      - a: "9"
#        b: "5"
#      - a: "9"
#        b: "6"
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
# - [REQ-166] Each implied condition's `$attribute-name` shall be taken from AST path
#   `[i].states[k].impliedConditions[*].attribute` and matched against the examples table column of
#   the same name. An implied condition on an attribute that is not present in the effective
#   examples table shall impose no filter.

Feature: m

  Scenario Outline: [] s "<a>" → s; when e
    Given initially s "<a>"
    When e
    Then expect s
    Examples:
      | a |
      | 9 |
