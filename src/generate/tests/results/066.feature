# Results from: state-arguments.test.ts, TST-066: suffix rendered after attribute name
# State machines:
#  - name: m
#    states:
#      - name: s
#    dataExampleValues:
#      - a: "1"
#    transitions:
#      - states:
#          - name: s
#            arguments:
#              - qualifier: with
#                name: a
#                suffix: prefilled
#        trigger:
#          type: event
#          name: e
#        result:
#          name: s
#        notes: ""
# Covers requirements:
# - [REQ-059] `$suffix` shall be the word/phrase after the attribute name.
# - [REQ-060] The `$suffix` shall be taken from AST path
#   `[i].transitions[j].states[*].arguments[*].suffix`.

Feature: m

  Scenario Outline: [] s with "<a>" prefilled → s; when e
    Given initially s with "<a>" prefilled
    When e
    Then expect s
    Examples:
      | a |
      | 1 |
