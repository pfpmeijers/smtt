# Results from: state-trigger-expansion-data.test.ts, TST-211: A chain-produced result value takes precedence over a stale base column
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
#  - name: m2
#    data:
#      a: ""
#    states:
#      - name: s3
#      - name: s4
#    transitions:
#      - states:
#          - name: s3
#        trigger:
#          type: state
#          name: s2
#          arguments:
#            - name: a
#        result:
#          name: s4
#          arguments:
#            - name: c
#              result:
#                value: a
#                valueIsReference: true
# Covers requirements:
# - [REQ-437] A bound result reference (REQ-438 in `smtt.parse.complete.md`) shall take its cell
#   value from the `resulting $attribute-name` column it is bound to, instead of from REQ-423's row
#   value of the referenced attribute.

Feature: m2

  Scenario Outline: [] s3 → s4 "<resulting c>"; when s2 "<a>"; given s1
    Given initially s3
    And initially s1
    When e "<b>"
    Then expect s2 "<resulting a>"
    And expect s4 "<resulting c>"
    Examples:
      | b | resulting c | resulting a |
      | 5 | 5           | 5           |
