# Results from: arguments-in-label.test.ts, TST-001: Arguments appear in the step state names
# State machines:
#  - name: m
#    states:
#      - name: s1
#      - name: s2
#    dataValueCombinations:
#      - a1: "1"
#        a2: "2"
#        a3: "3"
#    defaultPreconditions:
#      - state: s3
#        arguments:
#          - qualifier: on
#            name: a3
#    transitions:
#      - states:
#          - name: s1
#            arguments:
#              - qualifier: as
#                name: a1
#        trigger:
#          type: event
#          name: e
#          arguments:
#            - qualifier: with
#              name: ae
#        result:
#          name: s2
#          arguments:
#            - qualifier: from
#              name: a2
#        id: "000"
#  - name: m0
#    states:
#      - name: s3
# Covers requirements:
# - [REQ-049] The arguments shall be taken from AST paths:

Feature: m

  Scenario Outline: [000]
    Given initially s3 on "<a3>"
    And initially s1 as "<a1>"
    When e with "<ae>"
    Then expect s2 from "<a2>"
    Examples:
      | a3 | a1 | ae | a2 |
      | 3  | 1  |    | 2  |
