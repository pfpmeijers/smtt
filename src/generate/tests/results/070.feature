# Results from: state-trigger-expansion-data.test.ts, TST-070: Conditions across an expansion chain merge as a conjunction
# State machines:
#  - name: m1
#    states:
#      - name: s1
#      - name: s2
#    dataExampleValues:
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
#  - name: m2
#    states:
#      - name: s3
#      - name: s4
#    dataExampleValues:
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
# Covers requirements:
# - [REQ-162] Conditions from all transitions in an expansion chain shall be merged as a
#   conjunction: a row survives only if it satisfies ALL conditions from the top-level transition
#   AND all source transitions in the chain.

Feature: m2

  Scenario Outline: [] s3 → s4 as "<a>"; when s2 as "<a>"; given s1
    Given initially s1
    And initially s3
    When e with "<a>"
    Then expect s2 as "<a>"
    And expect s4 as "<a>"
    Examples:
      | a |
      | 1 |
