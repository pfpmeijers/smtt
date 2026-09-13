# Results from: conditions-filtering.test.ts, TST-175: Reference condition compares two attributes of the same row
# State machines:
#  - name: m
#    states:
#      - name: s
#    dataExampleValues:
#      - a1: "1"
#        a2: "1"
#      - a1: "2"
#        a2: "9"
#    transitions:
#      - states:
#          - name: s
#            arguments:
#              - name: a1
#              - name: a2
#                condition:
#                  operator: =
#                  value: a1
#                  valueIsReference: true
#        trigger:
#          type: event
#          name: e
#        result:
#          name: s
# Covers requirements:
# - [REQ-427] A condition value marked as an attribute reference (`...condition.valueIsReference`,
#   REQ-424 in `smtt.parse.validate.md`) shall not be compared as a literal: for each candidate row,
#   the condition shall be evaluated against the value that row itself holds for the referenced
#   attribute. The same condition can therefore hold for one row and fail for the next. A row that
#   holds no value for the referenced attribute — it has no column for it, or the cell is empty —
#   shall not survive the filter: an absent value pins nothing to compare against.

Feature: m

  Scenario Outline: [] s "<a1>", "<a2>" → s; when e
    Given initially s "<a1>", "<a2>"
    When e
    Then expect s
    Examples:
      | a1 | a2 |
      | 1  | 1  |
