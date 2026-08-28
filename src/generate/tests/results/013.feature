# Results from: conditions-filtering.test.ts, TST-013: Undefined condition filters to empty/absent values
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
#                  operator: undefined
#        trigger:
#          type: event
#          name: e
#        result:
#          name: s
# Covers requirements:
# - [REQ-086] Argument conditions shall filter/extend the data combination tables (`Examples`) by
#   removing rows/adding columns.
# - [REQ-087] Conditions on precondition state or trigger arguments (both `event`- and `state`-type
#   triggers) shall filter the examples rows to those that match. For `state`-type triggers this is
#   orthogonal to expansion candidate matching (REQ-118): expansion determines which source
#   transitions apply; the condition then filters the data rows.
# - [REQ-096] The generator shall support the unary absence check `undefined` (no value; checks that
#   the attribute is absent/unset).

Feature: m

  Scenario Outline: [] s "<a>" → s; when e
    Given initially s "<a>"
    When e
    Then expect s
    Examples:
      | a |
      |   |
