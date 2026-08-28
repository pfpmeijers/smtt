# Results from: state-trigger-expansion.test.ts, TST-074: State trigger with multiple expansion paths
# State machines:
#  - name: m1
#    states:
#      - name: s0
#      - name: s1
#    transitions:
#      - trigger:
#          type: event
#          name: e1
#        result:
#          name: s1
#      - trigger:
#          type: event
#          name: e2
#        result:
#          name: s1
#  - name: m2
#    states:
#      - name: s2
#    transitions:
#      - id: "001"
#        trigger:
#          type: state
#          name: s1
#        result:
#          name: s2
# Covers requirements:
# - [REQ-029] For state trigger based transitions with multiple expansion paths, a path suffix shall
#   be appended to the id.
# - [REQ-030] The `→ $result-state-name` part shall stay the same across paths.
# - [REQ-031] For expanded paths, `$context-states` in the label shall be the merged set of all
#   `Given` precondition states, excluding the own state, listed in effective step order (default
#   preconditions first, then merged transition states).
# - [REQ-113] When expansion produces multiple paths (multiple source transitions), each path shall
#   generate its own scenario, differentiated by a `.1`, `.2`, … suffix on the scenario (transition)
#   ID.

Feature: m2

  Scenario: [001.1] s2 → s2; when s1; given s0
    Given initially s0
    And initially s2
    When e1
    Then expect s1
    And expect s2

  Scenario: [001.2] s2 → s2; when s1; given s0
    Given initially s0
    And initially s2
    When e2
    Then expect s1
    And expect s2
