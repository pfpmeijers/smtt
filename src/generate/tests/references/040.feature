# Results from: layout.test.ts, TST-040: Blank line between consecutive Scenarios
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
#          name: e1
#        result:
#          name: s2
#      - states:
#          - name: s2
#        trigger:
#          type: event
#          name: e2
#        result:
#          name: s1
# Covers requirements:
# - [REQ-128] One blank line shall be emitted between consecutive `Scenario` / `Scenario Outline`
#   blocks.

Feature: m

  Scenario: [] s1 → s2; when e1
    Given initially s1
    When e1
    Then expect s2

  Scenario: [] s2 → s1; when e2
    Given initially s2
    When e2
    Then expect s1
