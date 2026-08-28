# Results from: layout.test.ts, TST-035: Step keywords indented 4 spaces
# State machines:
#  - name: m
#    states:
#      - name: s1
#    defaultPreconditions:
#      - state: s2
#    transitions:
#      - states:
#          - name: s1
#        trigger:
#          type: event
#          name: e
#        result:
#          name: s1
#  - name: m0
#    states:
#      - name: s2
# Covers requirements:
# - [REQ-119] All generated feature files shall follow standard Gherkin indentation conventions:
# - [REQ-123] The step keywords (`Given`, `And`, `When`, `Then`) shall be indented 4 spaces.

Feature: m

  Scenario: [] s1 → s1; when e; given s2
    Given initially s2
    And initially s1
    When e
    Then expect s1
