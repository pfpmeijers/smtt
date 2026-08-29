# Results from: empty-attribute-values.test.ts, TST-020: Empty string matches undefined operator
# State machines:
#  - name: m
#    states:
#      - name: s
#    dataExampleValues:
#      - a: ""
#      - a: "1"
#    transitions:
#      - states:
#          - name: s
#            arguments:
#              - name: a
#                condition:
#                  operator: undefined
#        trigger:
#          type: event
#          name: e
#        result:
#          name: s
#        notes: ""
# Covers requirements:
# - [REQ-073] An empty string (`""`) in `$example-data-values` shall represent an undefined/absent
#   value for that attribute.
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
      |   |
