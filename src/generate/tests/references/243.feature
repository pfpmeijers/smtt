# Results from: undefined-result-arguments.test.ts, TST-243: Result argument assigning its result state's `as` literal is not rendered
# State machines:
#  - name: m
#    states:
#      - name: s1
#      - name: s2
#        impliedConditions:
#          - attribute: a1
#            condition:
#              operator: as
#              value: v1
#    dataValueCombinations:
#      - a1: v1
#      - a1: v2
#    transitions:
#      - states:
#          - name: s1
#        trigger:
#          type: event
#          name: e
#        result:
#          name: s2
#          arguments:
#            - name: a1
#              result:
#                value: v1
#        notes: ""
# Covers requirements:
# - [REQ-442] A transition result's argument shall not be rendered when the result state's implied
#   conditions pin its attribute to one concrete value — absence via `undefined`, or a literal via
#   `=` or `as` (REQ-433 in `smtt.parse.validate.md`) — and the argument assigns exactly that value.
#   The `resulting $attribute-name` column then goes unreferenced and is dropped by REQ-436; a
#   transition whose only argument is suppressed this way renders as a plain `Scenario` (REQ-047).

Feature: m

  Scenario: [] s1 → s2; when e
    Given initially s1
    When e
    Then expect s2
