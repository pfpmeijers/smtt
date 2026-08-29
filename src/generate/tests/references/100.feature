# Results from: scenario-examples.test.ts, TST-100: Examples table removes rendered duplicate rows
# State machines:
#  - name: m
#    states:
#      - name: s
#    dataExampleValues:
#      - a1: V1
#        a2: "0"
#      - a1: V1
#        a2: "1"
#      - a1: V2
#        a2: "0"
#      - a1: V2
#        a2: "1"
#    transitions:
#      - states:
#          - name: s
#            arguments:
#              - qualifier: as
#                name: a1
#        trigger:
#          type: event
#          name: e
#        result:
#          name: s
#        notes: ""
# Covers requirements:
# - [REQ-160] Rendered examples table rows shall be unique: any row whose displayed values repeat an
#   earlier row in the final `Examples:` block shall be removed, keeping the first occurrence.
#   Duplicate rows shall be eliminated after filtering and before the final table is emitted.

Feature: m

  Scenario Outline: [] s as "<a1>" → s; when e
    Given initially s as "<a1>"
    When e
    Then expect s
    Examples:
      | a1 |
      | V1 |
      | V2 |
