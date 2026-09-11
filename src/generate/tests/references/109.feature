# Results from: conditions-result.test.ts, TST-109: Result value referencing another attribute resolves dynamically per row
# State machines:
#  - name: m
#    states:
#      - name: s
#    dataExampleValues:
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
# - [REQ-423] A result's `result.value` may instead name a reference to another attribute of the
#   same machine (`result.valueIsReference`), set directly by the grammar at parse time — a
#   backticked value is a reference, a double-quoted or bare numeric value is a literal — purely by
#   delimiter, with no name-matching or post-parse classification involved (unlike trigger
#   classification, which does match the trigger name against known state names post-parse). The
#   `resulting $attribute-name` column's cell value is then taken from that *row's own value* for
#   the referenced attribute, dynamically, instead of the fixed literal REQ-089 otherwise takes it
#   from.

Feature: m

  Scenario Outline: [] s "<a>" → s "<resulting b>"; when e
    Given initially s "<a>"
    When e
    Then expect s "<resulting b>"
    Examples:
      | a | resulting b |
      | 1 | 1           |
      | 2 | 2           |
