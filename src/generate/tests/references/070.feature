# Results from: state-trigger-expansion-data.test.ts, TST-070: Conditions across an expansion chain merge as a conjunction
# State machines:
#  - name: m1
#    states:
#      - name: s1
#      - name: s2
#    dataValueCombinations:
#      - a: "1"
#      - a: "2"
#    transitions:
#      - states:
#          - name: s1
#        trigger:
#          type: event
#          name: e
#          arguments:
#            - qualifier: with
#              name: a
#              condition:
#                operator: as
#                value: "1"
#        result:
#          name: s2
#          arguments:
#            - qualifier: as
#              name: a
#        notes: ""
#        id: "000"
#  - name: m2
#    states:
#      - name: s3
#      - name: s4
#    dataValueCombinations:
#      - a: "1"
#      - a: "2"
#    transitions:
#      - states:
#          - name: s3
#        trigger:
#          type: state
#          name: s2
#          arguments:
#            - qualifier: as
#              name: a
#        result:
#          name: s4
#          arguments:
#            - qualifier: as
#              name: a
#        notes: ""
#        id: "001"
# Covers requirements:
# - [REQ-162] Conditions from all transitions in an expansion chain shall be merged as a
#   conjunction: a row survives only if it satisfies ALL conditions from the top-level transition
#   AND all source transitions in the chain.

Feature: m2

  Scenario Outline: [001]
    Given initially s3
    And initially s1
    When e with "<a>"
    Then expect s2 as "<a>"
    And expect s4 as "<a>"
    Examples:
      | a |
      | 1 |
