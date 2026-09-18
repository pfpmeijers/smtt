# Results from: conditions-filtering.test.ts, TST-011: As binds the attribute to its literal value
# State machines:
#  - name: m
#    states:
#      - name: s
#    dataValueCombinations:
#      - a: a1
#      - a: a2
#    transitions:
#      - states:
#          - name: s
#            arguments:
#              - name: a
#                condition:
#                  operator: as
#                  value: a1
#        trigger:
#          type: event
#          name: e
#        result:
#          name: s
#        id: "000"
# Covers requirements:
# - [REQ-086] Argument conditions shall filter/extend the data combination tables (`Examples`) by
#   removing rows/adding columns.
# - [REQ-087] Conditions on precondition state or trigger arguments (both `event`- and `state`-type
#   triggers) shall filter the examples rows to those that match. For `state`-type triggers this is
#   orthogonal to expansion candidate matching (REQ-118): expansion determines which source
#   transitions apply; the condition then filters the data rows.
# - [REQ-432] The `as` operator shall state sameness rather than filter: the attribute *takes* the
#   value named — a literal, or, for an attribute reference (REQ-427), the value the referenced
#   attribute holds in the same row. Every such binding shall be applied to all rows before any
#   filter is evaluated, so a filter on a bound attribute tests the value the binding gave it rather
#   than whatever the declared table held.

Feature: m

  Scenario Outline: [000]
    Given initially s "<a>"
    When e
    Then expect s
    Examples:
      | a  |
      | a1 |
