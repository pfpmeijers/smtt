# Results from: modifiers.test.ts, TST-051: Decremented modifier adds derived column
# State machines:
#  - name: m
#    states:
#      - name: s
#    dataExampleValues:
#      - a: "0"
#      - a: "2"
#      - a: "1"
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
#            - modifier: decremented
#              name: a
#        notes: ""
# Covers requirements:
# - [REQ-065] The table shall add _derived_ columns required by modifiers.
# - [REQ-077] The `incremented` / `decremented` modifiers shall take the incremented / decremented
#   value from the examples table.
# - [REQ-078] The `incremented` / `decremented` modifier column shall be named `$modifier
#   $attribute-name`.

Feature: m

  Scenario Outline: [] s "<a>" → s "<decremented a>"; when e
    Given initially s "<a>"
    When e
    Then expect s "<decremented a>"
    Examples:
      | a | decremented a |
      | 0 | -1            |
      | 2 | 1             |
      | 1 | 0             |
