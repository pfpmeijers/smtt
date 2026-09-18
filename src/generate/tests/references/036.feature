# Results from: layout.test.ts, TST-036: Notes comment indented 4 spaces
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
#        notes: ...
#        id: "000"
# Covers requirements:
# - [REQ-119] All generated feature files shall follow standard Gherkin indentation conventions:
# - [REQ-124] The `# Notes:` comment shall be indented 4 spaces.

Feature: m

  Scenario: [000] ...
    Given initially s
    When e
    Then expect s
    # Notes: ...
