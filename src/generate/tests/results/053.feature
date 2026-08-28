# Results from: modifiers.test.ts, TST-053: Previous modifier uses circular previous value
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
#            - modifier: previous
#              name: a
#        result:
#          name: s
#        notes: ""
# Covers requirements:
# - [REQ-065] The table shall add _derived_ columns required by modifiers.
# - [REQ-081] The `previous` / `next` modifiers shall take the previous / next value from the
#   examples table, in a circular way (previous of first value is last value, next of last value is
#   first value).
# - [REQ-082] The `previous` / `next` modifier column shall be named `$modifier $attribute-name`.

Feature: m

  Scenario Outline: [] s "<a>" → s; when e "<previous a>"
    Given initially s "<a>"
    When e "<previous a>"
    Then expect s
    Examples:
      | a  | previous a |
      | a0 | a2         |
      | a1 | a0         |
      | a2 | a1         |
