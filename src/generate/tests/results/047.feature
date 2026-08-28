# Results from: modifier-with-condition.test.ts, TST-047: Modifier and condition co-exist; condition filters the derived value
# State machines:
#  - name: m
#    states:
#      - name: s
#    dataExampleValues:
#      - count: "1"
#      - count: "2"
#    transitions:
#      - states:
#          - name: s
#            arguments:
#              - name: count
#        trigger:
#          type: event
#          name: e
#          arguments:
#            - modifier: incremented
#              name: count
#              condition:
#                operator: ">"
#                value: "1"
#        result:
#          name: s
#        notes: ""
# Covers requirements:
# - [REQ-142] A modifier and a condition may co-exist on the same argument.
# - [REQ-143] When both are present, the order of operations shall be: derive the modifier column
#   value first, then filter rows where the derived value satisfies the condition.
# - [REQ-144] The condition applies to the derived (modified) value, not the base value.

Feature: m

  Scenario Outline: [] s "<count>" → s; when e "<incremented count>"
    Given initially s "<count>"
    When e "<incremented count>"
    Then expect s
    Examples:
      | count | incremented count |
      | 1     | 2                 |
      | 2     | 3                 |
