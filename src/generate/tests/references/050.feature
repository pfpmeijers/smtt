# Results from: modifiers.test.ts, TST-050: Incremented modifier adds derived column
# State machines:
#  - name: m
#    states:
#      - name: s
#    dataExampleValues:
#      - a: "1"
#      - a: "3"
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
#            - modifier: incremented
#              name: a
#        notes: ""
# Covers requirements:
# - [REQ-053] `$modifier` shall be the qualifying word/phrase before the attribute name.
# - [REQ-065] The table shall add _derived_ columns required by modifiers.
# - [REQ-070] Modifiers shall be added as additional columns per surviving row.
# - [REQ-076] Modifiers shall extend the data combination tables (`Examples`) by adding columns
#   based on the data attribute values.
# - [REQ-077] The `incremented` / `decremented` modifiers shall take the incremented / decremented
#   value from the examples table.
# - [REQ-078] The `incremented` / `decremented` modifier column shall be named `$modifier
#   $attribute-name`.
# - [REQ-079] The `incremented` / `decremented` modifiers shall only work on numerical values.
# - [REQ-137] When an argument carries a modifier, the step placeholder shall reference the derived
#   column name (e.g. `<incremented count>`, `<different email address>`) rather than the base
#   column name.
# - [REQ-152] Derived columns (`resulting X`, `incremented X`, `different X`, etc.) shall be
#   appended after all base columns, in their encounter order.

Feature: m

  Scenario Outline: [] s "<a>" → s "<incremented a>"; when e
    Given initially s "<a>"
    When e
    Then expect s "<incremented a>"
    Examples:
      | a | incremented a |
      | 1 | 2             |
      | 3 | 4             |
      | 2 | 3             |
