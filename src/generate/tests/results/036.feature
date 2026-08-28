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
# Covers requirements:
# - [REQ-119] All generated feature files shall follow standard Gherkin indentation conventions:
# - [REQ-124] The `# Notes:` comment shall be indented 4 spaces.

Feature: m

  Scenario: [] s → s; when e
    Given initially s
    When e
    Then expect s
    # Notes: ...
