# Results from: state-trigger-expansion.test.ts, TST-073: State trigger expansion adds intermediate Then
# State machines:
#  - name: m1
#    states:
#      - name: s1
#    transitions:
#      - trigger:
#          type: event
#          name: e
#        result:
#          name: s1
#  - name: m2
#    states:
#      - name: s2
#    transitions:
#      - trigger:
#          type: state
#          name: s1
#        result:
#          name: s2
# Covers requirements:
# - [REQ-109] For state triggers, an additional `Then expect $trigger-result-state-name` step shall
#   be emitted between the `When` step and the final `Then expect $result-state-name` step,
#   representing the direct result of the resolved event.
# - [REQ-110] This additional step shall reflect the causal chain: the event produced an
#   intermediate state, which triggered the transition, which produced the final result.

Feature: m2

  Scenario: [] s2 → s2; when s1; given s1
    Given initially s1
    And initially s2
    When e
    Then expect s1
    And expect s2
