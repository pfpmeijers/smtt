# Results from: modifiers.test.ts, TST-054: Different modifier selects first different value from examples table
# State machines:
#  - name: m
#    states:
#      - name: s
#    dataExampleValues:
#      - a: a1
#      - a: a2
#      - a: a3
#    transitions:
#      - states:
#          - name: s
#            arguments:
#              - name: a
#        trigger:
#          type: event
#          name: e
#          arguments:
#            - modifier: different
#              name: a
#        result:
#          name: s
#        notes: ""
# Covers requirements:
# - [REQ-065] The table shall add _derived_ columns required by modifiers.
# - [REQ-070] Modifiers shall be added as additional columns per surviving row.
# - [REQ-083] The `not` / `other` / `different` / `unequal` modifiers (with different wording
#   options, but meaning the same) shall select the first value in the example values table that is
#   different from the condition's value. I.e. for the row holding value `v`, the selected value
#   shall be the first value `w` in the example values table where `w != v`.
# - [REQ-085] Regardless of which synonym (`not`, `other`, `different`, `unequal`) appears in the
#   source, the derived column shall always be named `different $attribute-name`.

Feature: m

  Scenario Outline: [] s "<a>" → s; when e "<different a>"
    Given initially s "<a>"
    When e "<different a>"
    Then expect s
    Examples:
      | a  | different a |
      | a1 | a2          |
      | a2 | a1          |
      | a3 | a1          |
