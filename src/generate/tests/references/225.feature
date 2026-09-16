# Results from: equivalent-rows.test.ts, TST-225: A literal the model names keeps rows apart
# State machines:
#  - name: m
#    states:
#      - name: s
#    dataValueCombinations:
#      - current: user1
#        email: user1
#      - current: user1
#        email: user2
#      - current: user1
#        email: user3
#    transitions:
#      - states:
#          - name: s
#            arguments:
#              - name: current
#                condition:
#                  operator: =
#                  value: user1
#        trigger:
#          type: event
#          name: e
#          arguments:
#            - name: email
#        result:
#          name: s
# Covers requirements:
# - [REQ-440] A rendered examples table row shall be pruned when renaming its interchangeable values
#   turns it into an earlier row, keeping the first row.

Feature: m

  Scenario Outline: [] s "<current>" → s; when e "<email>"
    Given initially s "<current>"
    When e "<email>"
    Then expect s
    Examples:
      | current | email |
      | user1   | user1 |
      | user1   | user2 |
