# Results from: conditions-result.test.ts, TST-017: Attribute result values are always used for assignment
# State machines:
#  - name: m
#    states:
#      - name: s
#    dataExampleValues:
#      - a: "1"
#      - a: "2"
#      - a: "3"
#    transitions:
#      - trigger:
#          type: event
#          name: e
#        result:
#          name: s
#          arguments:
#            - name: a
#              result:
#                value: "2"
# Covers requirements:
# - [REQ-089] A result argument's value shall always be a plain equality assignment — the Result
#   column's `attribute set to value` syntax has no other operator to choose between. The `resulting
#   $attribute-name` column cell value shall be taken directly from `result.value` in the AST.

Feature: m

  Scenario Outline: [] s → s "<resulting a>"; when e
    Given initially s
    When e
    Then expect s "<resulting a>"
    Examples:
      | resulting a |
      | 2           |
