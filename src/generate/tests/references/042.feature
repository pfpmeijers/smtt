# Results from: layout.test.ts, TST-042: No blank line between Examples keyword and table
# State machines:
#  - name: m
#    states:
#      - name: s
#    dataValueCombinations:
#      - a: "1"
#    transitions:
#      - states:
#          - name: s
#            arguments:
#              - name: a
#        trigger:
#          type: event
#          name: e
#        result:
#          name: s
#        id: "000"
# Covers requirements:
# - [REQ-130] No blank line shall be emitted between `Examples:` and its table.

Feature: m

  Scenario Outline: [000]
    Given initially s "<a>"
    When e
    Then expect s
    Examples:
      | a |
      | 1 |
