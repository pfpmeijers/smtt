# Results from: scenario-examples.test.ts, TST-210: Examples table drops columns not referenced in any step
# State machines:
#  - name: m
#    states:
#      - name: s1
#    dataValueCombinations:
#      - a1: "1"
#        b1: "2"
#      - a1: "3"
#        b1: "2"
#    defaultPreconditions:
#      - state: s2
#        arguments:
#          - name: a1
#    transitions:
#      - states:
#          - name: s1
#            arguments:
#              - name: b1
#          - name: s3
#        trigger:
#          type: event
#          name: e
#        result:
#          name: s1
#        notes: ""
#        id: "000"
#  - name: m0
#    states:
#      - name: s2
#      - name: s3
# Covers requirements:
# - [REQ-436] A column shall be dropped from the table when its `<$column-name>` placeholder is not
#   rendered in any of the scenario's steps, e.g. an argument of a default precondition that the
#   transition overrides with an explicit state of the same machine. When no column remains, a plain
#   `Scenario` is rendered without an `Examples:` block (REQ-047).

Feature: m

  Scenario Outline: [000]
    Given initially s1 "<b1>"
    And initially s3
    When e
    Then expect s1
    Examples:
      | b1 |
      | 2  |
