# Results from: scenario-label.test.ts, TST-061: Scenario label omits the description when the transition has no notes
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
# Covers requirements:
# - [REQ-453] The ` $description` part shall be omitted when the transition has no notes, leaving
#   the label as `[$id]`.

Feature: m

  Scenario: [001]
    Given initially s1
    When e
    Then expect s2
