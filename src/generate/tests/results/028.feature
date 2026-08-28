# Results from: initial-state.test.ts, TST-028: Implied initial precondition taken from explicit initialState
# State machines:
#  - name: m1
#    states:
#      - name: s1
#  - name: m2
#    states:
#      - name: s2
#      - name: s3
#    initialState: s3
#    transitions:
#      - states:
#          - name: s1
#        trigger:
#          type: event
#          name: e2
#        result:
#          name: s3
#        notes: ""
# Covers requirements:
# - [REQ-133] The initial state shall be taken from AST path `[i].initialState`.

Feature: m2

  Scenario: [] s3 → s3; when e2; given s1
    Given initially s1
    And initially s3
    When e2
    Then expect s3
