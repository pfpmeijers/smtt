# Results from: scenario-label.test.ts, TST-059: Basic scenario label format
# State machines:
#  - name: m
#    states:
#      - name: s1
#      - name: s2
#    defaultPreconditions:
#      - state: s3
#    transitions:
#      - id: "001"
#        states:
#          - name: s1
#        trigger:
#          type: event
#          name: e
#        result:
#          name: s2
#  - name: m0
#    states:
#      - name: s3
# Covers requirements:
# - [REQ-009] The generator shall write one or more scenarios per transition with the following
#   label:
# - [REQ-010] The transition shall be taken from AST path `[i].transitions[j]`.
# - [REQ-011] The label shall include `[$id]`, the transition id.
# - [REQ-012] The `$id` shall be taken from AST path `[i].transitions[j].id`.
# - [REQ-013] The label shall include `$original-state-name`, i.e. the state machine's own "from"
#   state for this transition.
# - [REQ-014] The `$original-state-name` shall be taken from AST path
#   `[i].transitions[j].states[k].name`, where `k` is the index of the own state in the transition's
#   state array.
# - [REQ-015] The `$original-state-name` state shall be identified by matching each entry's name
#   against the state machine's defined state names taken from AST path `[i].states[*].name`, where
#   `i` is the index of the state machine the scenario belongs to.
# - [REQ-017] The label shall include ` → $result-state-name`, the state machine's "to" state for
#   this transition.
# - [REQ-018] The `$result-state-name` shall be taken from AST path
#   `[i].transitions[j].result.name`.
# - [REQ-019] The label shall include `; when $trigger`, the trigger name, being an event or a state
#   entered of another state machine.
# - [REQ-020] The `$trigger` shall be taken from AST path `[i].transitions[j].trigger.name`.
# - [REQ-021] The label shall include `; given $context-states`, all precondition states other than
#   the own state.

Feature: m

  Scenario: [001] s1 → s2; when e; given s3
    Given initially s3
    And initially s1
    When e
    Then expect s2
