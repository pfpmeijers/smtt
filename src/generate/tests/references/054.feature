# Results from: modifiers.test.ts, TST-054: Different modifier uses concatenated tables with circular next
# State machines:
#  - name: m
#    states:
#      - name: s
#    dataExampleValues:
#      - a: a1
#      - a: a2
#    dataOtherValues:
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
# - [REQ-070] Modifiers shall be added as additional columns per surviving row, based on additional
#   attribute value mappings from the `$other-data-values` table where necessary.
# - [REQ-071] The `$other-data-values` shall be taken from AST path `[i].dataOtherValues`.
# - [REQ-072] Values in `$other-data-values` serve as additional value pool entries for the
#   `different`/`not`/`other` modifier. They are not added as test example rows themselves, but
#   provide alternate values that can be selected via the circular derivation logic (REQ-083/084).
# - [REQ-083] The `not` / `other` / `different` modifiers (with different wording options, but
#   meaning the same) shall select the next-row-circular value from the concatenation of the example
#   values table and the other values table (examples first, then others).
# - [REQ-084] For the row at index `n`, the selected value shall be taken from row `(n + 1) % total
#   row count` of the concatenated list.
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
      | a2 | a3          |
