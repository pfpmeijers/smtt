# Results from: state-trigger-expansion.test.ts, TST-071: Event trigger maps directly to When step
# State machines:
#  - name: m
#    states:
#      - name: s
#    transitions:
#      - states:
#          - name: s
#        trigger:
#          type: event
#          name: e
#        result:
#          name: s
# Covers requirements:
# - [REQ-102] Triggers shall be of either `event` type or `state` type. A state trigger represents
#   another state machine entering that state, which then cascades into a transition of the current
#   state machine.
# - [REQ-103] The trigger type shall be taken from AST path `[i].transitions[j].trigger.type`.
# - [REQ-111] Both trigger types shall only determine the `When` step.

Feature: m

  Scenario: [] s → s; when e
    Given initially s
    When e
    Then expect s
