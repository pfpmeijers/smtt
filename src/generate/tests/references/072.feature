# Results from: state-trigger-expansion.test.ts, TST-072: State trigger expands to source event
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
# - [REQ-102] Triggers shall be of either `event` type or `state` type. A state trigger represents
#   another state machine entering that state, which then cascades into a transition of the current
#   state machine.
# - [REQ-104] For state triggers, the trigger shall not directly map to a `When` step. Instead, the
#   generator shall look up the transition(s) in the owning state machine that lead to the named
#   trigger state.
# - [REQ-106] The owning state machine shall be the machine `[i]` whose defined states (AST path
#   `[i].states[*].name`) contain the trigger state name.
# - [REQ-107] When the source has an event trigger, that trigger name shall become the `When` step.
# - [REQ-109] For state triggers, an additional `Then expect $trigger-result-state-name` step shall
#   be emitted between the `When` step and the final `Then expect $result-state-name` step,
#   representing the direct result of the resolved event.
# - [REQ-112] The final `Then` step shall always come from the transition result of the top level
#   transition.
# - [REQ-132] When no state from the current machine appears in the effective precondition list
#   (after default precondition injection), the machine's initial state shall be implied as
#   transition precondition, regardless of whether external preconditions exist.
# - [REQ-134] When the initial state is not explicitly defined, the state machine's first state
#   shall be used as initial state.
# - [REQ-135] The implied initial state rule (REQ-132/REQ-134) shall also apply when resolving each
#   source transition found during expansion: a source transition's own owning state machine (not
#   the top-level transition's machine) determines its default preconditions and effective initial
#   state for this purpose.
# - [REQ-150] The owning state machine of a state name shall be determined by finding the machine
#   whose `states` array contains an entry with a matching `name`. State names are globally unique
#   across all machines in the AST file.

Feature: m2

  Scenario: [] s2 → s2; when s1; given s1
    Given initially s1
    And initially s2
    When e
    Then expect s1
    And expect s2
