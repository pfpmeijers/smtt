# Results from: layout.test.ts, TST-037: Examples keyword indented 4 spaces
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
# - [REQ-119] All generated feature files shall follow standard Gherkin indentation conventions:
# - [REQ-125] The `Examples:` keyword shall be indented 4 spaces.

Feature: m

  Scenario Outline: [000]
    Given initially s "<a>"
    When e
    Then expect s
    Examples:
      | a |
      | 1 |
