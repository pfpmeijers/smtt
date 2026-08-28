# Results from: empty-attribute-values.test.ts, TST-019: Empty string in dataExampleValues treated as undefined
# State machines:
#  - name: m
#    states:
#      - name: s
#    dataExampleValues:
#      - a: "1"
#      - a: ""
#    transitions:
#      - states:
#          - name: s
#            arguments:
#              - name: a
#                condition:
#                  operator: =
#                  value: "1"
#        trigger:
#          type: event
#          name: e
#        result:
#          name: s
#        notes: ""
# Covers requirements:
# - [REQ-073] An empty string (`""`) in `$example-data-values` or `$other-data-values` shall
#   represent an undefined/absent value for that attribute.
# - [REQ-074] When used in modifier lookups or condition filtering, empty strings shall be treated
#   as undefined.
# - [REQ-075] Empty strings shall not match any comparison operator except `undefined`.

Feature: m

  Scenario Outline: [] s "<a>" → s; when e
    Given initially s "<a>"
    When e
    Then expect s
    Examples:
      | a |
      | 1 |
