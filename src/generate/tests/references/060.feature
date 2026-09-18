# Results from: scenario-label.test.ts, TST-060: Scenario label description keeps its casing and placeholders
# State machines:
#  - name: m
#    states:
#      - name: s1
#      - name: s2
#    dataValueCombinations:
#      - a: A
#    transitions:
#      - id: "001"
#        states:
#          - name: s1
#        trigger:
#          type: event
#          name: e
#          arguments:
#            - qualifier: with
#              name: a
#              condition:
#                operator: =
#                value: A
#        result:
#          name: s2
#        notes: Item Added With <a>
# Covers requirements:
# - [REQ-452] The `$description` shall be taken from AST path `[i].transitions[j].notes`, verbatim:
#   it is not lower cased and its placeholders are not rewritten.

Feature: m

  Scenario Outline: [001] Item Added With <a>
    Given initially s1
    When e with "<a>"
    Then expect s2
    # Notes: Item Added With <a>
    Examples:
      | a |
      | A |
