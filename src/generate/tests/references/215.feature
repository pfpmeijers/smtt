# Results from: state-trigger-expansion-data.test.ts, TST-215: An unbound reference keeps the value the attribute held before the event
# State machines:
#  - name: m1
#    states:
#      - name: s1
#      - name: s2
#    dataValueCombinations:
#      - b: "5"
#    transitions:
#      - states:
#          - name: s1
#        trigger:
#          type: event
#          name: e
#          arguments:
#            - name: b
#        result:
#          name: s2
#          arguments:
#            - name: a
#              result:
#                value: b
#                valueIsReference: true
#        id: "000"
#  - name: m2
#    states:
#      - name: s3
#      - name: s4
#    dataValueCombinations:
#      - a: "7"
#    transitions:
#      - states:
#          - name: s3
#            arguments:
#              - name: a
#        trigger:
#          type: state
#          name: s2
#        result:
#          name: s4
#          arguments:
#            - name: c
#              result:
#                value: a
#                valueIsReference: true
#        id: "001"
# Covers requirements:
# - [REQ-437] A bound result reference (REQ-438 in `smtt.parse.complete.md`) shall take its cell
#   value from the `resulting $attribute-name` column it is bound to, instead of from REQ-423's row
#   value of the referenced attribute.

Feature: m2

  Scenario Outline: [001]
    Given initially s3 "<a>"
    And initially s1
    When e "<b>"
    Then expect s2 "<resulting a>"
    And expect s4 "<resulting c>"
    Examples:
      | a | b | resulting c | resulting a |
      | 7 | 5 | 7           | 5           |
