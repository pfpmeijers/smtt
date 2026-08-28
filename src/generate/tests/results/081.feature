# Results from: steps-block.test.ts, TST-081: Default precondition injected when no overlap with owning state machine
# State machines:
#  - name: m
#    states:
#      - name: s1
#    defaultPreconditions:
#      - state: s2
#    transitions:
#      - trigger:
#          type: event
#          name: e
#        result:
#          name: s1
#  - name: m2
#    states:
#      - name: s2
# Covers requirements:
# - [REQ-036] A default precondition state shall only be used when the transition does not already
#   mention a state from the same owning state machine.

Feature: m

  Scenario: [] s1 → s1; when e; given s2
    Given initially s2
    And initially s1
    When e
    Then expect s1
