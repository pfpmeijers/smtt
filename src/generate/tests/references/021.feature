# Results from: empty-attribute-values.test.ts, TST-021: Empty string in modifier lookup is treated as undefined
# State machines:
#  - name: m
#    states:
#      - name: s
#    dataExampleValues:
#      - a: "1"
#    dataOtherValues:
#      - a: ""
#    transitions:
#      - states:
#          - name: s
#            arguments:
#              - name: a
#        trigger:
#          type: event
#          name: e
#          arguments:
#            - modifier: different
#              name: a
#        result:
#          name: s
#        notes: ""
# Covers requirements:
# - [REQ-073] An empty string (`""`) in `$example-data-values` or `$other-data-values` shall
#   represent an undefined/absent value for that attribute.
# - [REQ-074] When used in modifier lookups or condition filtering, empty strings shall be treated
#   as undefined.

Feature: m

  Scenario Outline: [] s "<a>" → s; when e "<different a>"
    Given initially s "<a>"
    When e "<different a>"
    Then expect s
    Examples:
      | a | different a |
      | 1 |             |
