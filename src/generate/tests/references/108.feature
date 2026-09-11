# Results from: conditions-result.test.ts, TST-108: Result value attribute with no other reference drops its base column
# State machines:
#  - name: m
#    states:
#      - name: s
#    dataExampleValues:
#      - a1: x
#        a2: "1"
#      - a1: y
#        a2: "2"
#    transitions:
#      - trigger:
#          type: event
#          name: e
#        result:
#          name: s
#          arguments:
#            - name: a1
#            - name: a2
#              result:
#                value: "2"
# Covers requirements:
# - [REQ-169] A base attribute name shall not receive a column when its only occurrence in the
#   transition is a result argument carrying a result value — such an argument's step placeholder
#   always references the derived `resulting $attribute-name` column instead (REQ-101), so the base
#   column would otherwise go unused in every rendered step. When the same attribute is also
#   referenced elsewhere in the transition without a result value (e.g. a precondition, trigger, or
#   plain result reference), its base column is kept, since that occurrence does render
#   `"<$attribute-name>"`.

Feature: m

  Scenario Outline: [] s → s "<a1>", "<resulting a2>"; when e
    Given initially s
    When e
    Then expect s "<a1>", "<resulting a2>"
    Examples:
      | a1 | resulting a2 |
      | x  | 2            |
      | y  | 2            |
