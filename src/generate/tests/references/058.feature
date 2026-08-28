# Results from: scenario-examples.test.ts, TST-058: Examples table rows from dataExampleValues
# State machines:
#  - name: m
#    states:
#      - name: s
#    dataExampleValues:
#      - a: "1"
#    transitions:
#      - states:
#          - name: s
#            arguments:
#              - qualifier: as
#                name: a
#        trigger:
#          type: event
#          name: e
#        result:
#          name: s
#        notes: ""
# Covers requirements:
# - [REQ-063] When the scenario carries arguments, an examples table shall be appended.
# - [REQ-067] Row construction shall use `$example-data-values` as starting point.
# - [REQ-068] The `$example-data-values` shall be taken from AST path `[i].dataExampleValues`.

Feature: m

  Scenario Outline: [] s as "<a>" → s; when e
    Given initially s as "<a>"
    When e
    Then expect s
    Examples:
      | a |
      | 1 |
