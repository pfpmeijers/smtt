# Results from: steps-block.test.ts, TST-082: When step from event trigger
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
# - [REQ-040] The `When` step shall be emitted as `When $trigger-name [$arguments]`.
# - [REQ-041] The trigger name shall be taken from AST path `[i].transitions[j].trigger.name`.

Feature: m

  Scenario: [] s → s; when e
    Given initially s
    When e
    Then expect s
