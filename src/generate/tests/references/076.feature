# Results from: state-trigger-expansion.test.ts, TST-076: Expanded scenario merges Given steps from both transitions
# State machines:
#  - name: m1
#    states:
#      - name: s1
#    defaultPreconditions:
#      - state: s3
#    transitions:
#      - states:
#          - name: s1
#        trigger:
#          type: event
#          name: e
#        result:
#          name: s1
#  - name: m2
#    states:
#      - name: s2
#    transitions:
#      - states:
#          - name: s2
#        trigger:
#          type: state
#          name: s1
#        result:
#          name: s2
#  - name: m3
#    states:
#      - name: s3
# Covers requirements:
# - [REQ-114] The `Given` precondition steps for an expanded scenario shall include states from both
#   the source (expanded) transition and the top-level transition.
# - [REQ-115] The `Given` precondition steps for an expanded scenario shall be merged in effective
#   order: the top-level transition's own default preconditions first (in their declared array
#   order), then the top-level transition's own explicit states (in their declared array order),
#   then the states injected by the expansion source(s). A source's own states are contributed in
#   the same recursive order (REQ-135): its own default preconditions first, then its own explicit
#   states.

Feature: m2

  Scenario: [] s2 → s2; when s1; given s3, s1
    Given initially s2
    And initially s3
    And initially s1
    When e
    Then expect s1
    And expect s2
