# Results from: state-arguments.test.ts, TST-063: Multiple arguments appended comma separated in order
# State machines:
#  - name: m
#    states:
#      - name: s
#    dataExampleValues:
#      - a: "1"
#        b: "2"
#    transitions:
#      - states:
#          - name: s
#            arguments:
#              - name: a
#              - name: b
#        trigger:
#          type: event
#          name: e
#        result:
#          name: s
#        notes: ""
# Covers requirements:
# - [REQ-050] Each argument shall be appended comma separated to the state name in order.

Feature: m

  Scenario Outline: [] s "<a>", "<b>" → s; when e
    Given initially s "<a>", "<b>"
    When e
    Then expect s
    Examples:
      | a | b |
      | 1 | 2 |
