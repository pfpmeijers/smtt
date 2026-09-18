# Results from: state-arguments.test.ts, TST-065: postQualifier rendered after modifier
# State machines:
#  - name: m
#    states:
#      - name: s
#    dataValueCombinations:
#      - a: "1"
#      - a: "2"
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
#          arguments:
#            - modifier: next
#              postQualifier: from
#              name: a
#        notes: ""
#        id: "000"
# Covers requirements:
# - [REQ-055] `$post-qualifier` shall be the qualifying word/phrase after the modifier.
# - [REQ-056] The `$post-qualifier` shall be taken from AST path
#   `[i].transitions[j].states[*].arguments[*].postQualifier`.

Feature: m

  Scenario Outline: [000]
    Given initially s "<a>"
    When e
    Then expect s from "<next a>"
    Examples:
      | a | next a |
      | 1 | 2      |
      | 2 | 1      |
