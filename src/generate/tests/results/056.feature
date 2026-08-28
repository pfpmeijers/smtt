# Results from: modifiers.test.ts, TST-056: Not modifier is synonym for different
# State machines:
#  - name: m
#    states:
#      - name: s
#    dataExampleValues:
#      - a: "1"
#      - a: "2"
#    dataOtherValues:
#      - a: "3"
#    transitions:
#      - states:
#          - name: s
#            arguments:
#              - name: a
#        trigger:
#          type: event
#          name: e
#          arguments:
#            - modifier: not
#              name: a
#        result:
#          name: s
#        notes: ""
# Covers requirements:
# - [REQ-083] The `not` / `other` / `different` modifiers (with different wording options, but
#   meaning the same) shall select the next-row-circular value from the concatenation of the example
#   values table and the other values table (examples first, then others).
# - [REQ-085] Regardless of which synonym (`not`, `other`, `different`, `unequal`) appears in the
#   source, the derived column shall always be named `different $attribute-name`.

Feature: m

  Scenario Outline: [] s "<a>" → s; when e "<different a>"
    Given initially s "<a>"
    When e "<different a>"
    Then expect s
    Examples:
      | a | different a |
      | 1 | 2           |
      | 2 | 3           |
