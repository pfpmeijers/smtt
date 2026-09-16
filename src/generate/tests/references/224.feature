# Results from: equivalent-rows.test.ts, TST-224: Rows that only rename values are pruned to the first
# State machines:
#  - name: m1
#    states:
#      - name: s1
#      - name: s2
#    dataValueCombinations:
#      - a1: v1
#        a2: v3
#      - a1: v1
#        a2: v4
#      - a1: v2
#        a2: v3
#      - a1: v2
#        a2: v4
#    transitions:
#      - states:
#          - name: s1
#        trigger:
#          type: event
#          name: e
#          arguments:
#            - name: a1
#            - name: a2
#        result:
#          name: s2
#          arguments:
#            - name: a3
#              result:
#                value: a1
#                valueIsReference: true
#            - name: a4
#              result:
#                value: a2
#                valueIsReference: true
# Covers requirements:
# - [REQ-440] A rendered examples table row shall be pruned when renaming its interchangeable values
#   turns it into an earlier row, keeping the first row.

Feature: m1

  Scenario Outline: [] s1 → s2 "<resulting a3>", "<resulting a4>"; when e "<a1>", "<a2>"
    Given initially s1
    When e "<a1>", "<a2>"
    Then expect s2 "<resulting a3>", "<resulting a4>"
    Examples:
      | a1 | a2 | resulting a3 | resulting a4 |
      | v1 | v3 | v1           | v3           |
