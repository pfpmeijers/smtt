# Results from: conditions-filtering.test.ts, TST-012: Text inequality condition filters out the matching value
# State machines:
#  - name: m
#    states:
#      - name: s
#    dataValueCombinations:
#      - a: a1
#      - a: a2
#    transitions:
#      - states:
#          - name: s
#            arguments:
#              - name: a
#                condition:
#                  operator: <>
#                  value: a1
#        trigger:
#          type: event
#          name: e
#        result:
#          name: s
#        id: "000"
# Covers requirements:
# - [REQ-095] The generator shall support the text spellings of the equality filters: `is` / `are`
#   for `=`, and `is not` / `are not` for `<>`. The `as` operator is not one of them — it states
#   sameness and binds (REQ-432).

Feature: m

  Scenario Outline: [000]
    Given initially s "<a>"
    When e
    Then expect s
    Examples:
      | a  |
      | a2 |
