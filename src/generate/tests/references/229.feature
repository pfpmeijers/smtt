# Results from: undefined-result-arguments.test.ts, TST-229: An authored `set to undefined` renders like the synthesized one
# State machines:
#  - name: m
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
#      - id: authored
#        states:
#          - name: s1
#        trigger:
#          type: event
#          name: e1
#        result:
#          name: s2
#          arguments:
#            - name: a
#              qualifier: with
#              result: {}
#        notes: ""
#      - id: synthesized
#        states:
#          - name: s1
#        trigger:
#          type: event
#          name: e2
#        result:
#          name: s2
#          arguments:
#            - name: a
#              result: {}
#        notes: ""
# Covers requirements:
# - [REQ-442] A transition result's argument shall not be rendered when the result state's implied
#   conditions pin its attribute to one concrete value — absence via `undefined`, or a literal via
#   `=` (REQ-433 in `smtt.parse.validate.md`) — and the argument assigns exactly that value. The
#   `resulting $attribute-name` column then goes unreferenced and is dropped by REQ-436; a
#   transition whose only argument is suppressed this way renders as a plain `Scenario` (REQ-047).

Feature: m

  Scenario: [authored] s1 → s2; when e1
    Given initially s1
    When e1
    Then expect s2

  Scenario: [synthesized] s1 → s2; when e2
    Given initially s1
    When e2
    Then expect s2
