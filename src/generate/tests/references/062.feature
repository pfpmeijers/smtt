# Results from: scenario-label.test.ts, TST-062: Scenario label includes context states in effective order
# State machines:
#  - name: m
#    states:
#      - name: s1
#    defaultPreconditions:
#      - state: s2
#      - state: s3
#    transitions:
#      - states:
#          - name: s1
#        trigger:
#          type: event
#          name: e
#        result:
#          name: s1
#  - name: m0
#    states:
#      - name: s2
#      - name: s3
# Covers requirements:
# - [REQ-021] The label shall include `; given $context-states`, all precondition states other than
#   the own state.
# - [REQ-022] The `$context-states` shall be rendered as a comma-separated list.
# - [REQ-023] The `$context-states` shall be listed in the same order as the `Given` steps: default
#   preconditions first (in their array order), then explicit transition states (excluding the own
#   state, in their array order).
# - [REQ-025] The context states shall be taken from AST paths `[i].transitions[j].states[*].name`
#   (except for the own state entry), and `[i].defaultPreconditions[*].state`.

Feature: m

  Scenario: [] s1 → s1; when e; given s2, s3
    Given initially s2
    And initially s3
    And initially s1
    When e
    Then expect s1
