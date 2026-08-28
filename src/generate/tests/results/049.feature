# Results from: modifiers-first-last.test.ts, TST-049: 'last' modifier column named 'last $attr'
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
#            - modifier: last
#              name: a
#        notes: ""
# Covers requirements:
# - [REQ-139] The `last` modifier shall always take the last value from the example values table,
#   regardless of the current row position.
# - [REQ-140] The `first` / `last` modifier column shall be named `$modifier $attribute-name`.

Feature: m

  Scenario Outline: [] s "<a>" → s "<last a>"; when e
    Given initially s "<a>"
    When e
    Then expect s "<last a>"
    Examples:
      | a  | last a |
      | a0 | a2     |
      | a1 | a2     |
      | a2 | a2     |
