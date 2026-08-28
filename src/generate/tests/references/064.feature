# Results from: state-arguments.test.ts, TST-064: preQualifier rendered before modifier
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
#            - preQualifier: under
#              modifier: different
#              name: a
#        notes: ""
# Covers requirements:
# - [REQ-051] `$pre-qualifier` shall be a qualifying word/phrase before the modifier.
# - [REQ-052] The `$pre-qualifier` shall be taken from AST path
#   `[i].transitions[j].states[*].arguments[*].preQualifier`.

Feature: m

  Scenario Outline: [] s "<a>" → s under "<different a>"; when e
    Given initially s "<a>"
    When e
    Then expect s under "<different a>"
    Examples:
      | a | different a |
      | 1 | 2           |
      | 2 | 1           |
