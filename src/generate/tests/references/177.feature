# Results from: state-trigger-expansion-data.test.ts, TST-177: A reference-valued trigger condition disqualifies no expansion source
# State machines:
#  - name: m1
#    states:
#      - name: s1
#      - name: s2
#    dataValueCombinations:
#      - a: "1"
#        b: "1"
#      - a: "2"
#        b: "9"
#    transitions:
#      - states:
#          - name: s1
#            arguments:
#              - name: a
#              - name: b
#        trigger:
#          type: event
#          name: e
#        result:
#          name: s2
#          arguments:
#            - name: a
#            - name: b
#        id: "000"
#  - name: m2
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
#              condition:
#                operator: =
#                value: b
#                valueIsReference: true
#        result:
#          name: s4
#        id: "001"
# Covers requirements:
# - [REQ-428] A reference-valued condition on a state trigger's argument shall impose no constraint
#   while matching expansion candidates (REQ-118): that matching is structural and has no example
#   row to resolve the reference against. The condition applies per row afterwards, as REQ-427
#   describes.

Feature: m2

  Scenario Outline: [001]
    Given initially s3
    And initially s1 "<a>", "<b>"
    When e
    Then expect s2 "<a>", "<b>"
    And expect s4
    Examples:
      | a | b |
      | 1 | 1 |
