# Results from: layout.test.ts, TST-034: Scenario keyword at 2 indent
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
# Covers requirements:
# - [REQ-119] All generated feature files shall follow standard Gherkin indentation conventions:
# - [REQ-122] The `Scenario:` / `Scenario Outline:` shall be indented 2 spaces.

Feature: m

  Scenario: [] s → s; when e
    Given initially s
    When e
    Then expect s
