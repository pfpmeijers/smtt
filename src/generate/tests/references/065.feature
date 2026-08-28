# Results from: state-arguments.test.ts, TST-065: postQualifier rendered after modifier
# State machines:
#  - name: m
#    states:
#      - name: s
#    dataExampleValues:
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
#            - modifier: different
#              postQualifier: from
#              name: a
#        notes: ""
# Covers requirements:
# - [REQ-055] `$post-qualifier` shall be the qualifying word/phrase after the modifier.
# - [REQ-056] The `$post-qualifier` shall be taken from AST path
#   `[i].transitions[j].states[*].arguments[*].postQualifier`.

Feature: m

  Scenario Outline: [] s "<a>" → s "<different a>" from; when e
    Given initially s "<a>"
    When e
    Then expect s "<different a>" from
    Examples:
      | a | different a |
      | 1 | 2           |
      | 2 | 1           |
