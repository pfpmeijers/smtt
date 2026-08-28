# Results from: modifiers-first-last.test.ts, TST-048: 'first' modifier column named 'first $attr'
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
#        result:
#          name: s
#          arguments:
#            - modifier: first
#              name: a
#        notes: ""
# Covers requirements:
# - [REQ-138] The `first` modifier shall always take the first value from the example values table,
#   regardless of the current row position.
# - [REQ-140] The `first` / `last` modifier column shall be named `$modifier $attribute-name`.

Feature: m

  Scenario Outline: [] s "<a>" → s "<first a>"; when e
    Given initially s "<a>"
    When e
    Then expect s "<first a>"
    Examples:
      | a  | first a |
      | a0 | a0      |
      | a1 | a0      |
      | a2 | a0      |
