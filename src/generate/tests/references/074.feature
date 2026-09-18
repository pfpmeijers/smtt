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
#        id: "000"
#      - trigger:
#          type: event
#          name: e2
#        result:
#          name: s1
#        id: "002"
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
#        notes: Chained
# Covers requirements:
# - [REQ-029] For state trigger based transitions with multiple expansion paths, a path suffix shall
#   be appended to the id, while the description stays the same across paths.
# - [REQ-113] When expansion produces multiple paths (multiple source transitions), each path shall
#   generate its own scenario, differentiated by a `.1`, `.2`, … suffix on the scenario (transition)
#   ID.

Feature: m2

  Scenario: [001.1] Chained
    Given initially s2
    And initially s0
    When e1
    Then expect s1
    And expect s2
    # Notes: Chained

  Scenario: [001.2] Chained
    Given initially s2
    And initially s0
    When e2
    Then expect s1
    And expect s2
    # Notes: Chained
