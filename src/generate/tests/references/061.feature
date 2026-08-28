# Results from: scenario-label.test.ts, TST-061: Scenario label omits given clause when no context states
# State machines:
#  - name: m
#    states:
#      - name: s1
#      - name: s2
#    transitions:
#      - states:
#          - name: s1
#        trigger:
#          type: event
#          name: e
#        result:
#          name: s2
# Covers requirements:
# - [REQ-024] The `; given $context-states` part shall be omitted when there are no context states.

Feature: m

  Scenario: [] s1 → s2; when e
    Given initially s1
    When e
    Then expect s2
