# Results from: scenario-examples.test.ts, TST-057: Examples table columns in first-encounter order
# State machines:
#  - name: m
#    states:
#      - name: s1
#    dataExampleValues:
#      - b4: "1"
#        b3: "2"
#        b2: "3"
#        b1: "4"
#    defaultPreconditions:
#      - state: s2
#        arguments:
#          - name: a1
#    transitions:
#      - states:
#          - name: s1
#            arguments:
#              - name: b1
#        trigger:
#          type: event
#          name: e
#          arguments:
#            - name: b2
#        result:
#          name: s1
#          arguments:
#            - name: b3
#        notes: ""
#  - name: m0
#    states:
#      - name: s2
# Covers requirements:
# - [REQ-064] The table shall include every _base_ argument name referenced in first-encounter order
#   — scanning default preconditions first (in their array order), then explicit transition states
#   (in their array order), then the trigger, then the result.
# - [REQ-151] Each base attribute name shall appear as a column exactly once, at its
#   first-encountered position.

Feature: m

  Scenario Outline: [] s1 "<b1>" → s1 "<b3>"; when e "<b2>"; given s2 "<a1>"
    Given initially s2 "<a1>"
    And initially s1 "<b1>"
    When e "<b2>"
    Then expect s1 "<b3>"
    Examples:
      | a1 | b1 | b2 | b3 |
      |    | 4  | 3  | 2  |
