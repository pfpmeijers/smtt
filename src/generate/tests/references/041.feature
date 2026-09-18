# Results from: layout.test.ts, TST-041: No blank line between last Then and Notes
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
#        id: "000"
# Covers requirements:
# - [REQ-129] No blank line shall be emitted between the last `Then` step and the `# Notes:`
#   comment.

Feature: m

  Scenario: [000] ...
    Given initially s
    When e
    Then expect s
    # Notes: ...
