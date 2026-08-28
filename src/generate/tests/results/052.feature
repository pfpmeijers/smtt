# Results from: modifiers.test.ts, TST-052: Next modifier uses circular next value
# State machines:
#  - name: m
#    states:
#      - name: s
#    dataExampleValues:
#      - a: a0
#      - a: a1
#      - a: a2
#    transitions:
#      - states:
#          - name: s
#            arguments:
#              - name: a
#        trigger:
#          type: event
#          name: e
#          arguments:
#            - modifier: next
#              name: a
#        result:
#          name: s
#        notes: ""
# Covers requirements:
# - [REQ-054] The `$modifier` shall be taken from AST path
#   `[i].transitions[j].states[*].arguments[*].modifier`.
# - [REQ-065] The table shall add _derived_ columns required by modifiers.
# - [REQ-081] The `previous` / `next` modifiers shall take the previous / next value from the
#   examples table, in a circular way (previous of first value is last value, next of last value is
#   first value).
# - [REQ-082] The `previous` / `next` modifier column shall be named `$modifier $attribute-name`.

Feature: m

  Scenario Outline: [] s "<a>" → s; when e "<next a>"
    Given initially s "<a>"
    When e "<next a>"
    Then expect s
    Examples:
      | a  | next a |
      | a0 | a1     |
      | a1 | a2     |
      | a2 | a0     |
