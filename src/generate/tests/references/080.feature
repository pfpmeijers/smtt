# Results from: steps-block.test.ts, TST-080: Default precondition skipped when transition already mentions a state from the same state machine
# State machines:
#  - name: m
#    states:
#      - name: s1
#      - name: s2
#    defaultPreconditions:
#      - state: s2
#    transitions:
#      - states:
#          - name: s1
#        trigger:
#          type: event
#          name: e
#        result:
#          name: s2
# Covers requirements:
# - [REQ-036] A default precondition state shall only be used when the transition does not already
#   mention a state from the same owning state machine.

Feature: m

  Scenario: [] s1 → s2; when e
    Given initially s1
    When e
    Then expect s2
