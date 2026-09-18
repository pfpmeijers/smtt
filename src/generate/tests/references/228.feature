# Results from: undefined-result-arguments.test.ts, TST-228: Result argument pinned undefined by its result state is not rendered
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
#      - states:
#          - name: s1
#        trigger:
#          type: event
#          name: e
#        result:
#          name: s2
#          arguments:
#            - name: a
#              result: {}
#        notes: ""
#        id: "000"
# Covers requirements:
# - [REQ-442] A transition result's argument shall not be rendered when the result state's implied
#   conditions pin its attribute to one concrete value — absence via `undefined`, or a literal via
#   `=` or `as` (REQ-433 in `smtt.parse.validate.md`) — and the argument assigns exactly that value.
#   The `resulting $attribute-name` column then goes unreferenced and is dropped by REQ-436; a
#   transition whose only argument is suppressed this way renders as a plain `Scenario` (REQ-047).
# - [REQ-436] A column shall be dropped from the table when its `<$column-name>` placeholder is not
#   rendered in any of the scenario's steps, e.g. an argument of a default precondition that the
#   transition overrides with an explicit state of the same machine. When no column remains, a plain
#   `Scenario` is rendered without an `Examples:` block (REQ-047).
# - [REQ-047] When any state, the trigger, or an applicable default precondition carries
#   argument(s), the scenario shall be emitted as a `Scenario Outline` with an examples table
#   (described further down), instead of a `Scenario`.

Feature: m

  Scenario: [000]
    Given initially s1
    When e
    Then expect s2
