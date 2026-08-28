# Results from: conditions-result.test.ts, TST-016: Result condition adds resulting column
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
#                condition:
#                  operator: =
#                  value: "1"
#        trigger:
#          type: event
#          name: e
#        result:
#          name: s
#          arguments:
#            - name: a
#              condition:
#                operator: =
#                value: "2"
#        notes: ""
# Covers requirements:
# - [REQ-066] The table shall add _derived_ columns required by conditions.
# - [REQ-088] Result conditions shall extend the columns.
# - [REQ-101] Conditions in result arguments shall potentially add additional columns in the
#   examples table, under the column name `resulting $attribute-name`, and result argument step
#   placeholders shall reference `"<resulting $attribute-name>"`.

Feature: m

  Scenario Outline: [] s "<a>" → s "<resulting a>"; when e
    Given initially s "<a>"
    When e
    Then expect s "<resulting a>"
    Examples:
      | a | resulting a |
      | 1 | 2           |
