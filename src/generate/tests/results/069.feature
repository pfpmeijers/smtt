# Results from: state-trigger-expansion-data.test.ts, TST-069: Expanded state trigger uses the combined data table of the chain
# State machines:
#  - name: m1
#    states:
#      - name: s1
#      - name: s2
#    dataExampleValues:
#      - a1: "1"
#      - a1: "2"
#    transitions:
#      - trigger:
#          type: event
#          name: e
#          arguments:
#            - name: a1
#        result:
#          name: s2
#  - name: m2
#    states:
#      - name: s3
#    dataExampleValues:
#      - a2: "3"
#      - a2: "4"
#    transitions:
#      - trigger:
#          type: state
#          name: s2
#          arguments:
#            - name: a1
#        result:
#          name: s3
#          arguments:
#            - name: a2
# Covers requirements:
# - [REQ-161] For expanded state triggers, the effective data table shall be the combination (union
#   of columns, intersection of shared-column rows) of the example data values tables from all
#   machines in the expansion chain.

Feature: m2

  Scenario Outline: [] s3 → s3 "<a2>"; when s2 "<a1>"; given s1
    Given initially s1
    And initially s3
    When e "<a1>"
    Then expect s2
    And expect s3 "<a2>"
    Examples:
      | a1 | a2 |
      | 1  | 3  |
      | 2  | 3  |
      | 1  | 4  |
      | 2  | 4  |
