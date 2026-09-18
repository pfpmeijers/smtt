# Results from: scenario-examples.test.ts, TST-058: Examples table rows from dataValueCombinations
# State machines:
#  - name: m
#    states:
#      - name: s
#    dataValueCombinations:
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
#        id: "000"
# Covers requirements:
# - [REQ-063] When the scenario carries arguments, an examples table shall be appended.
# - [REQ-067] Row construction shall use `$example-data-values` as starting point.
# - [REQ-068] The `$example-data-values` shall be taken from AST path `[i].dataValueCombinations`.
#   This table may contain both author-defined rows and rows synthesised by the `complete` step
#   (REQ-420/REQ-421); both kinds are treated identically by the generator.

Feature: m

  Scenario Outline: [000]
    Given initially s as "<a>"
    When e
    Then expect s
    Examples:
      | a |
      | 1 |
