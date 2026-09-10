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
#   mention a state from the same owning state machine. This lets a transition's own explicit states
#   override (and reposition) what a default precondition or the implied initial state would
#   otherwise have supplied: restating that machine's state explicitly, anywhere in the transition's
#   own `states` array, both substitutes for the default/implied value and places it among the
#   transition's own explicit states (REQ-035's second group) instead of at the front with the other
#   defaults — letting a single transition force a custom precondition order for itself.

Feature: m

  Scenario: [] s1 → s2; when e
    Given initially s1
    When e
    Then expect s2
