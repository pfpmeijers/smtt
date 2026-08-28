# Results from: conditions-filtering.test.ts, TST-007: In-range inclusive both bounds
# State machines:
#  - name: m
#    states:
#      - name: s
#    dataExampleValues:
#      - a: "0"
#      - a: "1"
#      - a: "2"
#      - a: "3"
#      - a: "4"
#      - a: "5"
#    transitions:
#      - states:
#          - name: s
#            arguments:
#              - name: a
#                condition:
#                  operator: in range
#                  value: "[1, 4]"
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
# - [REQ-092] The generator shall support range membership operators: `in range`, `not in range`,
#   e.g. `` `a in [1, 4]` ``.
# - [REQ-093] Boundary notation shall follow interval convention: `[` and `]` denote inclusive
#   bounds, `(` and `)` denote exclusive bounds.
# - [REQ-145] The boundary inclusivity/exclusivity shall be encoded within the condition value
#   strings themselves (e.g. the value array contains `"[1"` and `"4)"` for `[1, 4)`).

Feature: m

  Scenario Outline: [] s "<a>" → s; when e
    Given initially s "<a>"
    When e
    Then expect s
    Examples:
      | a |
      | 1 |
      | 2 |
      | 3 |
      | 4 |
