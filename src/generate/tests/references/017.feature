# Results from: conditions-result.test.ts, TST-017: Attribute result values are always used for assignment
# State machines:
#  - name: m
#    states:
#      - name: s
#    dataValueCombinations:
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
#        id: "000"
# Covers requirements:
# - [REQ-089] The `resulting $attribute-name` column cell value shall be taken directly from
#   `result.value` in the AST. A result argument's value is always a plain equality assignment
#   (REQ-415, `smtt.parse.validate.md`), so there is no operator to interpret here.

Feature: m

  Scenario Outline: [000]
    Given initially s
    When e
    Then expect s "<resulting a>"
    Examples:
      | resulting a |
      | 2           |
