# Results from: equivalent-rows.test.ts, TST-224: Rows that only rename values are pruned to the first
# State machines:
#  - name: m
#    states:
#      - name: unavailable
#      - name: available
#    dataValueCombinations:
#      - email: user1
#        name: User A
#      - email: user1
#        name: User B
#      - email: user2
#        name: User A
#      - email: user2
#        name: User B
#    transitions:
#      - states:
#          - name: unavailable
#        trigger:
#          type: event
#          name: confirmed
#          arguments:
#            - name: email
#            - name: name
#        result:
#          name: available
#          arguments:
#            - name: owner
#              result:
#                value: email
#                valueIsReference: true
#            - name: label
#              result:
#                value: name
#                valueIsReference: true
# Covers requirements:
# - [REQ-440] A rendered examples table row shall be pruned when renaming its interchangeable values
#   turns it into an earlier row, keeping the first row.

Feature: m

  Scenario Outline: [] unavailable → available "<resulting owner>", "<resulting label>"; when confirmed "<email>", "<name>"
    Given initially unavailable
    When confirmed "<email>", "<name>"
    Then expect available "<resulting owner>", "<resulting label>"
    Examples:
      | email | name   | resulting owner | resulting label |
      | user1 | User A | user1           | User A          |
