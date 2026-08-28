# Results from: layout.test.ts, TST-038: Examples table rows indented 6 spaces
# State machines:
#  - name: m
#    states:
#      - name: s
#    dataExampleValues:
#      - a: "1"
#    transitions:
#      - states:
#          - name: s
#            arguments:
#              - name: a
#        trigger:
#          type: event
#          name: e
#        result:
#          name: s
# Covers requirements:
# - [REQ-119] All generated feature files shall follow standard Gherkin indentation conventions:
# - [REQ-126] The examples table rows shall be indented 6 spaces.

Feature: m

  Scenario Outline: [] s "<a>" → s; when e
    Given initially s "<a>"
    When e
    Then expect s
    Examples:
      | a |
      | 1 |
