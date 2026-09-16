# Results from: conditions-result.test.ts, TST-109: Result value referencing another attribute resolves dynamically per row
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
#        result:
#          name: s
#          arguments:
#            - name: b
#              result:
#                value: a
#                valueIsReference: true
#        notes: ""
# Covers requirements:
# - [REQ-423] When a result's value is an attribute reference (`result.valueIsReference`, REQ-424 in
#   `smtt.parse.validate.md`), the `resulting $attribute-name` column's cell value shall be taken
#   from that *row's own value* for the referenced attribute, instead of the fixed literal REQ-089
#   otherwise takes it from.

Feature: m

  Scenario Outline: [] s "<a>" → s "<resulting b>"; when e
    Given initially s "<a>"
    When e
    Then expect s "<resulting b>"
    Examples:
      | a | resulting b |
      | 1 | 1           |
