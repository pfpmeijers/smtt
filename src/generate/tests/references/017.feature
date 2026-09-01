# Results from: conditions-result.test.ts, TST-017: Result conditions with equality operator
# State machines:
#  - name: m
#    states:
#      - name: s
#    dataExampleValues:
#      - a: "1"
#      - a: "2"
#      - a: "3"
#    transitions:
#      - trigger:
#          type: event
#          name: e
#        result:
#          name: s
#          arguments:
#            - name: a
#              condition:
#                operator: as
#                value: "2"
# Covers requirements:
# - [REQ-089] Result conditions shall be restricted to equality operators only (`=`, `as`). The
#   `resulting $attribute-name` column cell value shall be taken directly from `condition.value` in
#   the AST. The generator shall raise an error when a result condition uses a non-equality
#   operator.

Feature: m

  Scenario Outline: [] s → s "<resulting a>"; when e
    Given initially s
    When e
    Then expect s "<resulting a>"
    Examples:
      | resulting a |
      | 2           |
