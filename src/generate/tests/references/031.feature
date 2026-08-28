# Results from: label-truncation.test.ts, TST-031: Scenario label truncated to 200 chars with an ellipsis
# State machines:
#  - name: m
#    states:
#      - name: s
#    transitions:
#      - id: "001"
#        states:
#          - name: s
#        trigger:
#          type: event
#          name: e------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
#        result:
#          name: s
#        notes: ""
# Covers requirements:
# - [REQ-159] The scenario label shall be truncated to a maximum of 200 characters. The transition
#   ID (`[$id]`) ensures uniqueness regardless of truncation. Truncation shall occur at the end, and
#   appended with `...` suffix.

Feature: m

  Scenario: [001] s → s; when e----------------------------------------------------------------------------------------------------------------------------------------------------------------------...
    Given initially s
    When e------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
    Then expect s
