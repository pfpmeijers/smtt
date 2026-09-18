# Results from: equivalent-rows.test.ts, TST-225: A literal the model names keeps rows apart
# State machines:
#  - name: m1
#    states:
#      - name: s1
#    dataValueCombinations:
#      - a1: v1
#        a2: v1
#      - a1: v1
#        a2: v2
#      - a1: v1
#        a2: v3
#    transitions:
#      - states:
#          - name: s1
#            arguments:
#              - name: a1
#                condition:
#                  operator: =
#                  value: v1
#        trigger:
#          type: event
#          name: e
#          arguments:
#            - name: a2
#        result:
#          name: s1
#        id: "000"
# Covers requirements:
# - [REQ-440] A rendered examples table row shall be pruned when renaming its interchangeable values
#   turns it into an earlier row, keeping the first row.

Feature: m1

  Scenario Outline: [000]
    Given initially s1 "<a1>"
    When e "<a2>"
    Then expect s1
    Examples:
      | a1 | a2 |
      | v1 | v1 |
      | v1 | v2 |
