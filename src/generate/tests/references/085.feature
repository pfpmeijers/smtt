# Results from: steps-block.test.ts, TST-085: Notes omitted when not defined
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
#        id: "000"
# Covers requirements:
# - [REQ-045] `# Notes:` shall be appended after the final `Then` step (including any intermediate
#   expansion steps) when notes are defined.

Feature: m

  Scenario: [000]
    Given initially s
    When e
    Then expect s
