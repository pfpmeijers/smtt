# Results from: undefined-result-arguments.test.ts, TST-237: A result literal contradicting its result state's `=` pin stays rendered (validation would reject this input; not exercised here)
# State machines:
#  - name: m
#    states:
#      - name: s1
#      - name: s2
#        impliedConditions:
#          - attribute: n
#            condition:
#              operator: =
#              value: "0"
#    dataValueCombinations:
#      - n: "0"
#      - n: "1"
#    transitions:
#      - states:
#          - name: s1
#        trigger:
#          type: event
#          name: e
#        result:
#          name: s2
#          arguments:
#            - name: n
#              qualifier: with
#              result:
#                value: "1"
#        notes: ""
#        id: "000"
# Covers requirements:
# - [REQ-442] A transition result's argument shall not be rendered when the result state's implied
#   conditions pin its attribute to one concrete value — absence via `undefined`, or a literal via
#   `=` (REQ-433 in `smtt.parse.validate.md`) — and the argument assigns exactly that value. The
#   `resulting $attribute-name` column then goes unreferenced and is dropped by REQ-436; a
#   transition whose only argument is suppressed this way renders as a plain `Scenario` (REQ-047).

Feature: m

  Scenario Outline: [000]
    Given initially s1
    When e
    Then expect s2 with "<resulting n>"
    Examples:
      | resulting n |
      | 1           |
