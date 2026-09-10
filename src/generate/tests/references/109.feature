# Results from: conditions-result.test.ts, TST-109: Result condition referencing another attribute resolves dynamically per row
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
#              condition:
#                operator: =
#                value: a
#                valueIsReference: true
#        notes: ""
# Covers requirements:
# - [REQ-423] A result condition's `condition.value` may instead be classified as a reference to
#   another attribute of the same machine (`condition.valueIsReference`, set by the parser's
#   post-parse classification step the same way an event trigger is told apart from a state
#   trigger). The `resulting $attribute-name` column's cell value is then taken from that *row's own
#   value* for the referenced attribute, dynamically, instead of the fixed literal REQ-089 otherwise
#   takes it from.

Feature: m

  Scenario Outline: [] s "<a>" → s "<resulting b>"; when e
    Given initially s "<a>"
    When e
    Then expect s "<resulting b>"
    Examples:
      | a | resulting b |
      | 1 | 1           |
      | 2 | 2           |
