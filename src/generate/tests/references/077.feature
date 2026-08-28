# Results from: state-trigger-expansion.test.ts, TST-077: Expanded scenario deduplicates same state with same arguments
# State machines:
#  - name: m1
#    states:
#      - name: s1
#    dataExampleValues:
#      - a: "1"
#    transitions:
#      - states:
#          - name: s1
#            arguments:
#              - name: a
#        trigger:
#          type: event
#          name: e
#        result:
#          name: s1
#  - name: m2
#    states:
#      - name: s2
#    defaultPreconditions:
#      - state: s1
#        arguments:
#          - name: a
#    transitions:
#      - trigger:
#          type: state
#          name: s1
#        result:
#          name: s2
# Covers requirements:
# - [REQ-116] Duplicate state references (same name and same arguments) shall be de-duplicated,
#   keeping the first occurrence.

Feature: m2

  Scenario Outline: [] s2 → s2; when s1; given s1 "<a>"
    Given initially s1 "<a>"
    And initially s2
    When e
    Then expect s1
    And expect s2
    Examples:
      | a |
      | 1 |
