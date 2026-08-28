# Results from: modifier-original-table.test.ts, TST-046: 'next' modifier derives position from the original unfiltered table
# State machines:
#  - name: m
#    states:
#      - name: s
#    dataExampleValues:
#      - a: a0
#      - a: a1
#      - a: a2
#    transitions:
#      - states:
#          - name: s
#            arguments:
#              - name: a
#                condition:
#                  operator: not as
#                  value: a0
#        trigger:
#          type: event
#          name: e
#          arguments:
#            - modifier: next
#              name: a
#        result:
#          name: s
#        notes: ""
# Covers requirements:
# - [REQ-158] The `previous` / `next` modifiers shall derive position from the *original* full
#   example values table, not from any condition-filtered subset. The `incremented` / `decremented`
#   modifiers operate on the row's own value (±1) independently and are unaffected by row filtering.

Feature: m

  Scenario Outline: [] s "<a>" → s; when e "<next a>"
    Given initially s "<a>"
    When e "<next a>"
    Then expect s
    Examples:
      | a  | next a |
      | a1 | a2     |
      | a2 | a0     |
