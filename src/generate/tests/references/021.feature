# Results from: empty-attribute-values.test.ts, TST-021: Empty string in modifier lookup is treated as undefined
# State machines:
#  - name: m
#    states:
#      - name: s
#    dataValueCombinations:
#      - a: "1"
#      - a: "2"
#    transitions:
#      - states:
#          - name: s
#            arguments:
#              - name: a
#        trigger:
#          type: event
#          name: e
#          arguments:
#            - modifier: next
#              name: a
#        result:
#          name: s
#        notes: ""
#        id: "000"
# Covers requirements:
# - [REQ-073] An empty string (`""`) in `$example-data-values` shall represent an undefined/absent
#   value for that attribute.
# - [REQ-074] When used in modifier lookups or condition filtering, empty strings shall be treated
#   as undefined.

Feature: m

  Scenario Outline: [000]
    Given initially s "<a>"
    When e "<next a>"
    Then expect s
    Examples:
      | a | next a |
      | 1 | 2      |
      | 2 | 1      |
