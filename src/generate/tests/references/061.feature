# Results from: scenario-label.test.ts, TST-061: Scenario label omits the description when the transition has none, even with notes
# State machines:
#  - name: m
#    states:
#      - name: s1
#      - name: s2
#    transitions:
#      - id: "001"
#        states:
#          - name: s1
#        trigger:
#          type: event
#          name: e
#        result:
#          name: s2
#        notes: Not a label
# Covers requirements:
# - [REQ-453] The ` $description` part shall be omitted when the transition has no description,
#   leaving the label as `[$id]`, even when the transition has notes.

Feature: m

  Scenario: [001]
    Given initially s1
    When e
    Then expect s2
    # Notes: Not a label
