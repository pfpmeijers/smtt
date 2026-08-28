# Results from: steps-block.test.ts, TST-084: Notes appended after last Then
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
#        notes: ...
# Covers requirements:
# - [REQ-045] `# Notes:` shall be appended after the final `Then` step (including any intermediate
#   expansion steps) when notes are defined.
# - [REQ-046] The notes shall be taken from AST path `[i].transitions[j].notes`.

Feature: m

  Scenario: [] s → s; when e
    Given initially s
    When e
    Then expect s
    # Notes: ...
