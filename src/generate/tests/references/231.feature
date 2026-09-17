# Results from: undefined-result-arguments.test.ts, TST-231: A suppressed result still binds a state trigger to undefined
# State machines:
#  - name: m1
#    states:
#      - name: s1
#      - name: s2
#        impliedConditions:
#          - attribute: a
#            condition:
#              operator: undefined
#    dataValueCombinations:
#      - a: ""
#      - a: "1"
#    transitions:
#      - states:
#          - name: s1
#            arguments:
#              - name: a
#        trigger:
#          type: event
#          name: e
#        result:
#          name: s2
#          arguments:
#            - name: a
#              result: {}
#        notes: ""
#  - name: m2
#    states:
#      - name: s3
#      - name: s4
#    dataValueCombinations:
#      - c: ""
#      - c: "9"
#    transitions:
#      - states:
#          - name: s3
#        trigger:
#          type: state
#          name: s2
#          arguments:
#            - name: a
#        result:
#          name: s4
#          arguments:
#            - name: c
#              result:
#                value: a
#                valueIsReference: true
#        notes: ""
# Covers requirements:
# - [REQ-442] A transition result's argument shall not be rendered when the result state's implied
#   conditions pin its attribute to one concrete value — absence via `undefined`, or a literal via
#   `=` (REQ-433 in `smtt.parse.validate.md`) — and the argument assigns exactly that value. The
#   `resulting $attribute-name` column then goes unreferenced and is dropped by REQ-436; a
#   transition whose only argument is suppressed this way renders as a plain `Scenario` (REQ-047).

Feature: m2

  Scenario Outline: [] s3 → s4 "<resulting c>"; when s2 "<a>"; given s1 "<a>"
    Given initially s3
    And initially s1 "<a>"
    When e
    Then expect s2
    And expect s4 "<resulting c>"
    Examples:
      | a | resulting c |
      |   |             |
      | 1 |             |
