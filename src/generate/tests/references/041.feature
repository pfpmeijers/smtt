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
# Covers requirements:
# - [REQ-129] No blank line shall be emitted between the last `Then` step and the `# Notes:`
#   comment.

Feature: m

  Scenario: [] s → s; when e
    Given initially s
    When e
    Then expect s
    # Notes: ...
